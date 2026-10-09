'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { JudgeMessage } from '@/lib/companion/judge-demo';
import { normalizeSpokenQuestion, speakable, speechParts, stripCitations } from '@/lib/companion/voice';
import styles from './demo.module.css';

// Browser speech APIs (Chrome/Edge expose recognition as SpeechRecognition or webkitSpeechRecognition).
type Recognition = {
  lang: string; interimResults: boolean; continuous: boolean; maxAlternatives: number;
  start(): void; stop(): void; abort(): void;
  onresult: ((event: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};
type State = 'idle' | 'listening' | 'thinking' | 'speaking';
const recognitionErrors: Record<string, string> = {
  'not-allowed': 'Microphone access is blocked. Allow it in the address bar, or tap a suggestion below.',
  'service-not-allowed': 'Voice input is unavailable in this browser profile. Tap a suggestion or type below.',
  'no-speech': 'I didn’t hear anything. Tap the ring and try again.',
  'audio-capture': 'No microphone was found. Tap a suggestion or type below.',
  network: 'Chrome’s speech recognition needs an internet connection. Tap a suggestion or type below.',
};
const suggestions = {
  TENANT: ['Was the scuff already there when I moved in?', 'Dispute the wall charge for me', 'What do the kitchen photos show?'],
  LANDLORD: ['What did the tenant say about the wall?', 'Show evidence for the second deduction', 'What is the refund right now?'],
};

// Browser capabilities and the spoken-reply preference are read as external stores,
// so the server render (no voice) and the first client render always match.
const PREFERENCE = 'rentalease-voice-replies';
let memoryPreference = true; // used when the browser blocks site storage
const never = () => () => undefined;
const hasRecognition = () => { const w = window as unknown as Record<string, unknown>; return typeof (w.SpeechRecognition ?? w.webkitSpeechRecognition) === 'function'; };
const hasSynthesis = () => typeof speechSynthesis !== 'undefined';
function subscribePreference(onChange: () => void) {
  window.addEventListener('storage', onChange); window.addEventListener(PREFERENCE, onChange);
  return () => { window.removeEventListener('storage', onChange); window.removeEventListener(PREFERENCE, onChange); };
}
function readPreference() { try { const stored = localStorage.getItem(PREFERENCE); return stored === null ? memoryPreference : stored !== 'off'; } catch { return memoryPreference; } }

function englishVoice() {
  const voices = typeof speechSynthesis === 'undefined' ? [] : speechSynthesis.getVoices().filter(v => v.lang.toLowerCase().startsWith('en'));
  return voices.find(v => /Google US English|Samantha|Aria|Jenny|Natural/i.test(v.name)) ?? voices.find(v => v.lang === 'en-US') ?? voices[0];
}

export default function VoiceAssistant({ role, mode, model, disabled, pending, aiDraftPending, ask, latest }: {
  role: 'TENANT' | 'LANDLORD'; mode: 'bedrock' | 'rules'; model?: string; disabled: boolean; pending: boolean; aiDraftPending: boolean;
  ask: (question: string) => Promise<JudgeMessage | null>; latest: JudgeMessage | null;
}) {
  const [state, setState] = useState<State>('idle');
  const [heard, setHeard] = useState(''), [hint, setHint] = useState('');
  const canListen = useSyncExternalStore(never, hasRecognition, () => false);
  const canSpeak = useSyncExternalStore(never, hasSynthesis, () => false);
  const voiceOn = useSyncExternalStore(subscribePreference, readPreference, () => true);
  const recognition = useRef<Recognition | null>(null), transcript = useRef('');
  // Speech and recognition finish asynchronously; read the latest props through refs.
  const latest$ = useRef({ ask, voiceOn, disabled });
  useEffect(() => { latest$.current = { ask, voiceOn, disabled }; });
  // Each reply gets a generation number so late callbacks from an older reply are ignored.
  const generation = useRef(0), fallback = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const utterances = useRef<SpeechSynthesisUtterance[]>([]);
  useEffect(() => () => {
    recognition.current?.abort(); clearTimeout(fallback.current);
    if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
  }, []);

  function stopSpeaking() {
    generation.current++; clearTimeout(fallback.current); utterances.current = [];
    if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
  }
  function stopListening() {
    const active = recognition.current;
    recognition.current = null; transcript.current = '';
    active?.abort();
  }

  function speak(text: string) {
    stopSpeaking();
    if (!latest$.current.voiceOn || typeof speechSynthesis === 'undefined' || !text) { setState('idle'); return; }
    const mine = generation.current, voice = englishVoice();
    const done = () => { if (generation.current === mine) { clearTimeout(fallback.current); utterances.current = []; setState('idle'); } };
    // One utterance per sentence: Chrome stops long utterances early.
    utterances.current = speechParts(text).map((part, i, parts) => {
      const utterance = new SpeechSynthesisUtterance(part);
      utterance.lang = voice?.lang ?? 'en-US'; if (voice) utterance.voice = voice;
      if (i === parts.length - 1) { utterance.onend = done; utterance.onerror = done; }
      return utterance;
    });
    utterances.current.forEach(utterance => speechSynthesis.speak(utterance));
    // Some platforms never fire onend; never leave the ring "speaking" indefinitely.
    fallback.current = setTimeout(done, 4000 + text.length * 90);
    setState('speaking');
  }

  async function submit(question: string) {
    stopListening(); stopSpeaking();
    const text = question.trim();
    if (!text || latest$.current.disabled) { setState('idle'); return; }
    setHeard(text);
    if (!normalizeSpokenQuestion(text)) { setHint('What would you like to ask RentalEase? Tap the ring and ask your question.'); setState('idle'); return; }
    setHint(''); setState('thinking');
    const message = await latest$.current.ask(text);
    if (!message) { setState('idle'); return; }
    speak(message.speech ?? speakable(message.text));
  }

  function toggleListening() {
    if (state === 'speaking') { stopSpeaking(); setState('idle'); return; }
    if (state === 'listening') { recognition.current?.stop(); return; }
    if (state === 'thinking' || disabled) return;
    const w = window as unknown as Record<string, new () => Recognition>;
    const Speech = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Speech) { setHint('Voice input needs Chrome or Edge. Tap a suggestion or type below; answers are still read aloud.'); return; }
    stopSpeaking(); stopListening();
    const listener = new Speech();
    Object.assign(listener, { lang: 'en-US', interimResults: true, continuous: false, maxAlternatives: 1 });
    // Browsers normally stop after a pause; never leave the ring listening indefinitely.
    const safety = setTimeout(() => listener.stop(), 15000);
    listener.onresult = event => {
      if (recognition.current !== listener) return;
      let text = '';
      for (let i = 0; i < event.results.length; i++) text += event.results[i][0].transcript;
      transcript.current = text; setHeard(text);
    };
    listener.onerror = event => {
      if (recognition.current === listener && event.error !== 'aborted') setHint(recognitionErrors[event.error] ?? 'Voice input stopped. Tap the ring to try again.');
    };
    listener.onend = () => {
      clearTimeout(safety);
      if (recognition.current !== listener) return; // aborted or replaced
      const spoken = transcript.current;
      recognition.current = null; transcript.current = '';
      if (spoken.trim()) void submit(spoken);
      else setState(current => current === 'listening' ? 'idle' : current);
    };
    recognition.current = listener;
    setHeard(''); setHint(''); setState('listening');
    try { listener.start(); } catch { clearTimeout(safety); recognition.current = null; setState('idle'); setHint('Voice input could not start. Tap the ring again.'); }
  }

  function toggleVoice() {
    const next = !voiceOn;
    memoryPreference = next;
    if (!next) { stopSpeaking(); setState(s => s === 'speaking' ? 'idle' : s); }
    try { localStorage.setItem(PREFERENCE, next ? 'on' : 'off'); } catch { /* storage blocked: the in-memory value applies until reload */ }
    window.dispatchEvent(new Event(PREFERENCE));
  }

  const status = { idle: pending ? 'A decision preview is waiting below. Confirm and save it, or cancel it, before asking again.'
    : canListen ? 'Tap the ring and ask a question.' : 'Tap a suggestion or type below.',
    listening: 'Listening… tap again when you finish.', thinking: mode === 'bedrock' ? 'Thinking with Amazon Bedrock and the RentalEase MCP tools…' : 'Checking the records…',
    speaking: 'Speaking… tap the ring to stop.' }[state];
  const answer = latest && state !== 'thinking' ? latest : null;
  return <section className={styles.device} aria-labelledby="voice-heading">
    <button type="button" className={`${styles.ring} ${styles[state] ?? ''}`} onClick={toggleListening} disabled={disabled && state === 'idle'}
      aria-label={state === 'listening' ? 'Stop listening' : state === 'speaking' ? 'Stop speaking' : 'Ask by voice'} aria-pressed={state === 'listening'}>
      <svg viewBox="0 0 24 24" aria-hidden="true" width="40" height="40"><path fill="currentColor" d="M12 15a3.5 3.5 0 0 0 3.5-3.5v-6a3.5 3.5 0 1 0-7 0v6A3.5 3.5 0 0 0 12 15Zm6-3.5a1 1 0 1 1 2 0 8 8 0 0 1-7 7.94V21h2a1 1 0 1 1 0 2H9a1 1 0 1 1 0-2h2v-1.56a8 8 0 0 1-7-7.94 1 1 0 1 1 2 0 6 6 0 0 0 12 0Z" /></svg>
    </button>
    <div className={styles.deviceBody}>
      <p className={styles.deviceEyebrow}>Alexa+ simulated experience · voice runs in your browser</p>
      <h2 id="voice-heading">Ask RentalEase.</h2>
      <p className={styles.deviceStatus} role="status">{status}</p>
      {heard && <p className={styles.heard}>“{heard}”</p>}
      {hint && <p className={styles.hint} role="alert">{hint}</p>}
      {/* Always mounted so screen readers announce each new answer. */}
      <div className={answer ? styles.answer : undefined} aria-live="polite">{answer && <>
        <p>{answer.provider === 'bedrock' ? stripCitations(answer.text) : answer.speech ?? answer.text.split('\n\n')[0]}</p>
        {answer.sourceIds.length > 0 && <div className={styles.deviceSources}>Sources: {answer.sourceIds.map(id =>
          <a key={id} href={id.startsWith('file:') ? '/api/judge/photo?id=' + encodeURIComponent(id.slice(5)) : '#source-' + id}
            target={id.startsWith('file:') ? '_blank' : undefined} rel={id.startsWith('file:') ? 'noreferrer' : undefined}>{id}</a>)}</div>}
        <small>{answer.provider === 'bedrock' ? `Amazon Bedrock · ${answer.model} · MCP tools: ${answer.tools?.join(' → ') || 'none'}` : 'Rule mode · quoted from the records'}
          {aiDraftPending ? ' · AI draft ready below' : ''}</small>
      </>}</div>
      <div className={styles.suggestions} aria-label="Suggested questions">
        {suggestions[role].map(s => <button type="button" key={s} disabled={disabled || state === 'thinking'} onClick={() => void submit(s)}>{s}</button>)}
      </div>
      <div className={styles.deviceFooter}>
        <span>{mode === 'bedrock' ? `Amazon Bedrock configured · ${model}` : 'Rule mode · no cloud keys'}</span>
        {canSpeak && <button type="button" className={styles.voiceToggle} onClick={toggleVoice} aria-pressed={voiceOn}>{voiceOn ? 'Spoken replies on' : 'Spoken replies off'}</button>}
      </div>
    </div>
  </section>;
}
