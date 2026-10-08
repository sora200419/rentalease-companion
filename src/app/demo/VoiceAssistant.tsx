'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { JudgeMessage } from '@/lib/companion/judge-demo';
import { speakable } from '@/lib/companion/voice';
import styles from './demo.module.css';

// Browser speech APIs (Chrome/Edge expose recognition as webkitSpeechRecognition).
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
const never = () => () => undefined;
const hasRecognition = () => { const w = window as unknown as Record<string, unknown>; return typeof (w.SpeechRecognition ?? w.webkitSpeechRecognition) === 'function'; };
const hasSynthesis = () => typeof speechSynthesis !== 'undefined';
function subscribePreference(onChange: () => void) {
  window.addEventListener('storage', onChange); window.addEventListener(PREFERENCE, onChange);
  return () => { window.removeEventListener('storage', onChange); window.removeEventListener(PREFERENCE, onChange); };
}
function readPreference() { try { return localStorage.getItem(PREFERENCE) !== 'off'; } catch { return true; } }

function englishVoice() {
  const voices = typeof speechSynthesis === 'undefined' ? [] : speechSynthesis.getVoices().filter(v => v.lang.toLowerCase().startsWith('en'));
  return voices.find(v => /Google US English|Samantha|Aria|Jenny|Natural/i.test(v.name)) ?? voices.find(v => v.lang === 'en-US') ?? voices[0];
}

export default function VoiceAssistant({ role, mode, model, disabled, pending, ask, latest }: {
  role: 'TENANT' | 'LANDLORD'; mode: 'bedrock' | 'rules'; model?: string; disabled: boolean; pending: boolean;
  ask: (question: string) => Promise<JudgeMessage | null>; latest: JudgeMessage | null;
}) {
  const [state, setState] = useState<State>('idle');
  const [heard, setHeard] = useState(''), [hint, setHint] = useState('');
  const canListen = useSyncExternalStore(never, hasRecognition, () => false);
  const canSpeak = useSyncExternalStore(never, hasSynthesis, () => false);
  const voiceOn = useSyncExternalStore(subscribePreference, readPreference, () => true);
  const recognition = useRef<Recognition | null>(null), transcript = useRef('');
  // Recognition finishes asynchronously; always use the latest ask (current revision) and preference.
  const latestAsk = useRef(ask), latestVoiceOn = useRef(voiceOn);
  useEffect(() => { latestAsk.current = ask; latestVoiceOn.current = voiceOn; });
  useEffect(() => () => { recognition.current?.abort(); if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel(); }, []);

  function speak(text: string) {
    if (!latestVoiceOn.current || typeof speechSynthesis === 'undefined' || !text) { setState('idle'); return; }
    speechSynthesis.cancel();
    // Chrome stops long utterances early, so queue one utterance per sentence.
    const parts = text.match(/[^.!?]+[.!?]*\s*/g)?.map(p => p.trim()).filter(Boolean) ?? [text];
    const voice = englishVoice();
    parts.forEach((part, i) => {
      const utterance = new SpeechSynthesisUtterance(part);
      utterance.lang = voice?.lang ?? 'en-US'; if (voice) utterance.voice = voice;
      if (i === parts.length - 1) { utterance.onend = () => setState('idle'); utterance.onerror = () => setState('idle'); }
      speechSynthesis.speak(utterance);
    });
    setState('speaking');
  }

  async function submit(question: string) {
    const text = question.trim();
    if (!text || disabled) { setState('idle'); return; }
    setHeard(text); setHint(''); setState('thinking');
    const message = await latestAsk.current(text);
    if (!message) { setState('idle'); return; }
    speak(message.speech ?? speakable(message.text));
  }

  function toggleListening() {
    if (state === 'speaking') { speechSynthesis.cancel(); setState('idle'); return; }
    if (state === 'listening') { recognition.current?.stop(); return; }
    if (state === 'thinking' || disabled) return;
    const w = window as unknown as Record<string, new () => Recognition>;
    const Speech = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Speech) { setHint('Voice input needs Chrome or Edge. Tap a suggestion or type below; answers are still read aloud.'); return; }
    const listener = new Speech();
    Object.assign(listener, { lang: 'en-US', interimResults: true, continuous: false, maxAlternatives: 1 });
    transcript.current = '';
    listener.onresult = event => {
      let text = '';
      for (let i = 0; i < event.results.length; i++) text += event.results[i][0].transcript;
      transcript.current = text; setHeard(text);
    };
    listener.onerror = event => { if (event.error !== 'aborted') setHint(recognitionErrors[event.error] ?? 'Voice input stopped. Tap the ring to try again.'); };
    // Browsers normally stop after a pause; never leave the ring listening indefinitely.
    const safety = setTimeout(() => listener.stop(), 15000);
    listener.onend = () => {
      clearTimeout(safety);
      recognition.current = null;
      if (transcript.current.trim()) void submit(transcript.current);
      else setState(current => current === 'listening' ? 'idle' : current);
    };
    if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
    recognition.current = listener;
    setHeard(''); setHint(''); setState('listening');
    try { listener.start(); } catch { setState('idle'); setHint('Voice input could not start. Tap the ring again.'); }
  }

  function toggleVoice() {
    const next = !voiceOn;
    if (!next && typeof speechSynthesis !== 'undefined') { speechSynthesis.cancel(); setState(s => s === 'speaking' ? 'idle' : s); }
    try { localStorage.setItem(PREFERENCE, next ? 'on' : 'off'); } catch { /* storage unavailable: the toggle resets on reload */ }
    window.dispatchEvent(new Event(PREFERENCE));
  }

  const status = { idle: pending ? 'A decision preview is waiting below. Confirm and save it, or cancel it, before asking again.'
    : canListen ? 'Tap the ring and ask a question.' : 'Tap a suggestion or type below.',
    listening: 'Listening… tap again when you finish.', thinking: mode === 'bedrock' ? 'Thinking with Amazon Bedrock and the RentalEase MCP tools…' : 'Checking the records…',
    speaking: 'Speaking… tap the ring to stop.' }[state];
  const answer = latest && (state !== 'thinking') ? latest : null;
  return <section className={styles.device} aria-labelledby="voice-heading">
    <button type="button" className={`${styles.ring} ${styles[state] ?? ''}`} onClick={toggleListening} disabled={disabled && state === 'idle'}
      aria-label={state === 'listening' ? 'Stop listening' : state === 'speaking' ? 'Stop speaking' : 'Ask by voice'} aria-pressed={state === 'listening'}>
      <svg viewBox="0 0 24 24" aria-hidden="true" width="40" height="40"><path fill="currentColor" d="M12 15a3.5 3.5 0 0 0 3.5-3.5v-6a3.5 3.5 0 1 0-7 0v6A3.5 3.5 0 0 0 12 15Zm6-3.5a1 1 0 1 1 2 0 8 8 0 0 1-7 7.94V21h2a1 1 0 1 1 0 2H9a1 1 0 1 1 0-2h2v-1.56a8 8 0 0 1-7-7.94 1 1 0 1 1 2 0 6 6 0 0 0 12 0Z" /></svg>
    </button>
    <div className={styles.deviceBody}>
      <p className={styles.deviceEyebrow}>Alexa+ simulated experience · voice runs in your browser</p>
      <h2 id="voice-heading">Ask RentalEase.</h2>
      <p className={styles.deviceStatus} role="status" aria-live="polite">{status}</p>
      {heard && <p className={styles.heard}>“{heard}”</p>}
      {hint && <p className={styles.hint} role="alert">{hint}</p>}
      {answer && <div className={styles.answer} aria-live="polite">
        <p>{answer.provider === 'bedrock' ? answer.text.replace(/\s*\[[a-zA-Z0-9:_-]{1,80}\]/g, '') : answer.speech ?? answer.text.split('\n\n')[0]}</p>
        {answer.sourceIds.length > 0 && <div className={styles.deviceSources}>Sources: {answer.sourceIds.map(id =>
          <a key={id} href={id.startsWith('file:') ? '/api/judge/photo?id=' + encodeURIComponent(id.slice(5)) : '#source-' + id}
            target={id.startsWith('file:') ? '_blank' : undefined} rel={id.startsWith('file:') ? 'noreferrer' : undefined}>{id}</a>)}</div>}
        <small>{answer.provider === 'bedrock' ? `Amazon Bedrock · ${answer.model} · MCP tools: ${answer.tools?.join(' → ') || 'none'}` : 'Rule mode · quoted from the records'}
          {answer.drafted ? ' · AI draft ready below' : ''}</small>
      </div>}
      <div className={styles.suggestions} aria-label="Suggested questions">
        {suggestions[role].map(s => <button type="button" key={s} disabled={disabled || state === 'thinking'} onClick={() => void submit(s)}>{s}</button>)}
      </div>
      <div className={styles.deviceFooter}>
        <span>{mode === 'bedrock' ? `Amazon Bedrock · ${model}` : 'Rule mode · no cloud keys'}</span>
        {canSpeak && <button type="button" className={styles.voiceToggle} onClick={toggleVoice} aria-pressed={voiceOn}>{voiceOn ? 'Spoken replies on' : 'Spoken replies off'}</button>}
      </div>
    </div>
  </section>;
}
