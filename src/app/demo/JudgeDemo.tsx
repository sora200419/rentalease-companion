'use client';

import { useEffect, useRef, useState } from 'react';
import type { JudgeMessage, JudgeSnapshot, Scenario } from '@/lib/companion/judge-demo';
import type { ActionInput, ActionKind } from '@/lib/companion/records-actions';
import { labels, optionsFor, routeDialogue } from '@/lib/companion/records-dialogue';
import { money, parseMoney } from '@/lib/companion/records-workflow';
import { settlementSummary } from '@/lib/companion/records-summary';
import { evidenceNotices } from '@/lib/companion/records-evidence-notices';
import { disputeTemplate, normalizeSpokenQuestion } from '@/lib/companion/voice';
import VoiceAssistant from './VoiceAssistant';
import McpConnect from './McpConnect';
import styles from './demo.module.css';

const fixed: Partial<Record<ActionKind, string>> = {
  ACCEPTANCE: 'I accept this landlord response.', ADJUSTMENT_ACCEPTANCE: 'I accept this proposed deduction amount.',
  DEDUCTION_ACCEPTANCE: 'I accept this recorded deduction.',
};
type Snapshot = JudgeSnapshot & { assistant: { mode: 'bedrock' | 'rules'; model?: string } };
async function request(operation: string, body?: unknown): Promise<Snapshot> {
  // An AI answer may make several model and tool calls, so it gets a longer deadline.
  const response = await fetch('/api/judge/' + operation, { method: body ? 'POST' : 'GET', cache: 'no-store',
    credentials: 'same-origin', headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(operation === 'assistant' ? 45000 : 15000) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? 'The demo request failed. Reload before retrying a confirmation.');
  return result;
}
export default function JudgeDemo() {
  const [session, setSession] = useState<Snapshot | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [question, setQuestion] = useState(''), [kind, setKind] = useState<ActionKind | ''>('');
  const [text, setText] = useState(''), [amount, setAmount] = useState('');
  const [scenario, setScenario] = useState<Scenario>('STANDARD'), [newScenario, setNewScenario] = useState(false);
  const initialRequest = useRef<Promise<Snapshot> | null>(null);
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        // Development StrictMode replays effects. Reuse the first request so
        // one page mount cannot allocate two cases and race its session cookie.
        const current = await (initialRequest.current ??= request('session'));
        if (!active) return;
        const resumed = await request('resume', { revision: current.revision });
        if (active) setSession(resumed);
      } catch (e) { if (active) setError(e instanceof Error ? e.message : 'Could not load demo.'); }
    })();
    return () => { active = false; };
  }, []);
  function clearDraft() { setKind(''); setText(''); setAmount(''); }
  async function command(operation: string, input: Record<string, unknown> = {}) {
    if (busy || (!session && operation !== 'start')) return null;
    setBusy(true); setError('');
    try {
      const updated = await request(operation, { ...(operation === 'start' ? {} : { revision: session!.revision }), ...input });
      setSession(updated); return updated;
    } catch (e) { setError((e instanceof Error ? e.message : 'Request failed.') + ' If a confirmation was interrupted, reload to check saved history before trying again.'); return null; }
    finally { setBusy(false); }
  }
  const records = session?.records, selected = records?.settlement?.deductions.find(d => d.id === session?.selected);
  const options = records ? optionsFor(records, session!.selected).filter(o => o.kind !== 'REPORT') : [];
  const summary = records ? settlementSummary(records) : null;
  const selection = options.find(o => o.kind === kind);
  function choose(value: ActionKind | '') { setKind(value); setText(value ? fixed[value] ?? '' : ''); setAmount(''); }
  async function prepare() {
    if (!selection || !kind) return;
    const payload: ActionInput['payload'] = { text };
    if (['DISPUTE','WITHDRAWAL','ADJUSTMENT','DEDUCTION_ACCEPTANCE'].includes(kind)) payload.deductionId = selection.target;
    if (kind === 'RESPONSE') payload.disputeId = selection.target;
    if (['ACCEPTANCE','REJECTION'].includes(kind)) payload.responseId = selection.target;
    if (['ADJUSTMENT_ACCEPTANCE','ADJUSTMENT_REJECTION'].includes(kind)) payload.adjustmentId = selection.target;
    if (kind === 'ADJUSTMENT') {
      const sen = parseMoney(amount);
      if (sen === null || sen < 1) { setError('Enter one exact MYR amount, for example 20.00. Use withdrawal for zero.'); return; }
      payload.amountSen = sen;
    }
    await command('prepare', { action: { kind, payload } });
  }
  // Typed and spoken questions share one path. With Amazon Bedrock the server may
  // return a ready preview; in rule mode the matching form is pre-selected here.
  async function askAssistant(input: string): Promise<JudgeMessage | null> {
    if (!session || !input.trim()) return null;
    const spoken = normalizeSpokenQuestion(input);
    const route = routeDialogue(session.records, session.selected, spoken);
    const updated = await command('assistant', { question: input });
    if (!updated) return null;
    const answer = updated.messages.at(-1) ?? null;
    if (answer?.provider !== 'bedrock' && !updated.pending) {
      choose(route.kind ?? ''); setAmount(route.amount);
      if (route.kind === 'DISPUTE') setText(disputeTemplate(updated.records));
    } else clearDraft();
    return answer;
  }
  async function ask() { if (await askAssistant(question)) setQuestion(''); }
  const citation = (id: string) => id.startsWith('file:') ? '/api/judge/photo?id=' + encodeURIComponent(id.slice(5)) : '#source-' + id;
  const assistant = session?.assistant ?? { mode: 'rules' as const };
  const latest = session?.messages.at(-1) ?? null;
  return <main className={styles.page}>
    <header className={styles.header}><a className={styles.brand} href="/guide">re. RentalEase</a><span className={styles.eyebrow}>{assistant.mode === 'bedrock' ? 'Amazon Bedrock connected' : 'Rule mode · no cloud keys needed'}</span></header>
    <div className={styles.intro}><p className={styles.eyebrow}>Evidence first. Decisions by you.</p><h1>A clearer end<br />to your tenancy.</h1>
      <p>Ask about any deposit deduction by voice or text. RentalEase reads the move-in and move-out records through its MCP tools, quotes the sources, and drafts a reply — but only you can confirm a decision.</p>
      <p className={styles.small}>Alexa+ track · simulated experience. All people, records and labelled photos are synthetic; role switching simulates two people. No legal ruling or payment is made.</p></div>
    {error && <p className={styles.notice} role="alert">{error}</p>}
    {!session && <p role="status">Loading the local demonstration…</p>}
    <div className={styles.toolbar}>
      <div className={styles.actions} aria-label="Demo roles">
        {(['TENANT','LANDLORD'] as const).map(role => <button key={role} disabled={busy || !session} aria-pressed={records?.role === role} onClick={async () => { if (await command('role', { role })) clearDraft(); }}>{role === 'TENANT' ? 'Tenant · Aina' : 'Landlord · Daniel'}</button>)}
      </div>
      <button disabled={busy} onClick={() => setNewScenario(!newScenario)}>Start another scenario</button>
    </div>
    {newScenario && <section className={styles.panel}><h2>A fresh, separate case.</h2><p>Previous local histories remain on disk. This starts a new synthetic session and does not touch Supabase or the original companion demo.</p>
      <label htmlFor="scenario">Evidence scenario</label><select id="scenario" value={scenario} onChange={e => setScenario(e.target.value as Scenario)}>
        <option value="STANDARD">Standard · report and photo pairs</option><option value="MISSING">Missing · no move-in report or photos</option><option value="CONFLICTING">Conflicting · disputed baseline and different accounts</option>
      </select><div className={styles.actions}><button disabled={busy} onClick={async () => { if (await command('start', { scenario, confirmed: true })) { clearDraft(); setNewScenario(false); } }}>Confirm new scenario</button><button disabled={busy} onClick={() => setNewScenario(false)}>Keep current case</button></div>
    </section>}
    {session && records && summary && <>
      <VoiceAssistant role={records.role === 'LANDLORD' ? 'LANDLORD' : 'TENANT'} mode={assistant.mode} model={assistant.model}
        disabled={busy || !!session.pending} pending={!!session.pending} ask={askAssistant} latest={latest} />
      <div className={styles.metrics}><div>Recorded deposit<strong>{money(records.depositSen)}</strong></div><div>Current refund<strong>{money(records.settlement!.recordedRefundSen)}</strong></div><div>Resolved deductions<strong>{summary.resolvedCount} / 3</strong></div></div>
      <p>{summary.title} · {session.scenario.toLowerCase()} evidence · saved record revision {records.revision}. Proposed new amounts do not change the refund until accepted. No money is transferred.</p>
      <p className={styles.notice} role="status">{session.notice}</p>
      <div className={styles.grid}><div>
        <section className={styles.panel}><p className={styles.eyebrow}>01 / Choose the item</p><h2>One deduction, one decision.</h2>
          <div className={styles.deductions}>{summary.items.map(item => <button id={'source-' + item.id} key={item.id} disabled={busy} aria-pressed={session.selected === item.id}
            onClick={async () => { if (await command('select', { deductionId: item.id })) clearDraft(); }}><span>{item.number}. {item.reason}<small>{item.status} · {item.next}</small>{item.pendingAmountSen !== null && <small>Pending offer: {money(item.pendingAmountSen)}</small>}</span><strong>{money(item.amountSen)}</strong></button>)}</div>
        </section>
        <section className={styles.panel}><p className={styles.eyebrow}>02 / Follow the sources</p><h2>{selected?.reason ?? 'Select a deduction'} — evidence</h2>
          {evidenceNotices(records.evidence).map(notice => <p key={notice}>{notice}</p>)}
          <div className={styles.photos}>{session.photos.filter(p => p.deductionId === session.selected).map(photo => <figure id={'photo-' + photo.id} key={photo.id}>
            <a href={'/api/judge/photo?id=' + photo.id} target="_blank" rel="noreferrer">
              {/* Bundled PNGs are session-gated and never sent to an external image service. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={'/api/judge/photo?id=' + photo.id} alt={photo.phase + ': ' + photo.description + '. AI-generated demo, not real evidence.'} />
            </a><figcaption><strong>{photo.id} · {photo.phase}</strong><br />{photo.description}<br /><a href={'#source-' + photo.reportId}>Report: {photo.reportId}</a><br />AI-GENERATED DEMO — NOT REAL EVIDENCE</figcaption>
          </figure>)}</div>
          {!session.photos.some(p => p.deductionId === session.selected) && <p>No photos are linked to this deduction. This absence does not prove either party’s claim.</p>}
          {records.evidence.map(source => <article id={'source-' + source.id} className={styles.source} key={source.id}><h3>{source.id} · {source.kind.replaceAll('_',' ')}</h3><small>{source.status} · {source.submittedAt}</small><p>{source.text}</p></article>)}
          {records.agreement && <article id={'source-' + records.agreement.id} className={styles.source}><h3>{records.agreement.id} · Agreement</h3><p>{records.agreement.text}</p></article>}
        </section>
      </div><div>
        <section className={styles.panel}><p className={styles.eyebrow}>03 / Ask, review, confirm</p><h2>The rental conversation.</h2><p>Current context: {selected?.reason ?? 'none'}. Multi-item requests need clarification. Chat never confirms a decision.</p>
          <div className={styles.conversation} aria-label="Conversation history">{session.messages.map((message, i) => <article className={styles.message} key={i}><strong>You: {message.question}</strong><p className={styles.pre}>{message.text}</p>
            <p className={styles.provider}>{message.provider === 'bedrock' ? `Amazon Bedrock · ${message.model} · MCP tools: ${message.tools?.join(' → ') || 'none'}${message.drafted ? ' · drafted a decision' : ''}` : 'Rule mode · quoted from the records'}</p>
            <div className={styles.citations}>{message.sourceIds.map(id => <a key={id} href={citation(id)} target={id.startsWith('file:') ? '_blank' : undefined} rel={id.startsWith('file:') ? 'noreferrer' : undefined}>{id}</a>)}</div></article>)}</div>
          <form onSubmit={e => { e.preventDefault(); void ask(); }}><label htmlFor="question">Ask about evidence or state a decision</label><textarea id="question" maxLength={600} value={question} onChange={e => setQuestion(e.target.value)} placeholder="Show evidence for the second deduction" disabled={busy} /><button disabled={busy || !question.trim()} type="submit">Send message</button></form>
          <form onSubmit={e => { e.preventDefault(); void prepare(); }}><label htmlFor="decision">Available action for this item</label><select id="decision" value={kind} disabled={busy || !!session.pending} onChange={e => choose(e.target.value as ActionKind | '')}>
            <option value="">Choose a decision</option>{options.map(o => <option key={o.kind} value={o.kind}>{labels[o.kind]}</option>)}
          </select>
          {kind && selection && <><label htmlFor="message">Your recorded message</label><textarea id="message" value={text} maxLength={2000} readOnly={!!fixed[kind]} disabled={busy || !!session.pending} onChange={e => setText(e.target.value)} />
            {kind === 'ADJUSTMENT' && <><label htmlFor="amount">New proposed amount (MYR)</label><input id="amount" inputMode="decimal" value={amount} disabled={busy || !!session.pending} onChange={e => setAmount(e.target.value)} placeholder="20.00" /></>}
            <button type="submit" disabled={busy || !!session.pending || text.trim().length < 10}>Preview decision</button></>}
          </form>
          {session.pending && <section className={styles.preview} aria-label="Decision preview"><h3>Check before saving</h3>
            {latest?.drafted && <p className={styles.aiDraft}>Drafted by Amazon Bedrock from the quoted records. Read it carefully: you decide whether to save it.</p>}<p>{session.pending.role} · {session.pending.description}</p><p className={styles.pre}>{session.pending.action.payload.text}</p><p>Valid for five minutes. Confirming records this exact decision locally. Cancelling or refreshing discards the preview.</p>
            <div className={styles.actions}><button className={styles.primary} disabled={busy} onClick={async () => { if (await command('confirm', { id: session.pending!.id })) clearDraft(); }}>Confirm and save</button><button disabled={busy} onClick={async () => { if (await command('cancel')) clearDraft(); }}>Cancel preview</button></div></section>}
        </section>
        <section className={styles.panel}><h2>Shared decision history.</h2><p>Both demo roles see confirmed decisions. Drafts, cancelled previews and chat messages are not settlement events.</p>
          {!records.history.some(e => e.kind !== 'EVIDENCE_LINK') && <p>No decisions saved yet.</p>}
          <ol className={styles.history}>{records.history.filter(e => e.kind !== 'EVIDENCE_LINK').map(event => <li key={event.id}><strong>{labels[event.kind]}</strong><small>Revision {event.revision} · {event.actorId} · {event.createdAt}</small><p>{event.payload.text}</p>{event.payload.amountSen !== undefined && <p>Proposed: {money(event.payload.amountSen)}</p>}</li>)}</ol>
        </section>
      </div></div>
      <McpConnect role={records.role === 'LANDLORD' ? 'LANDLORD' : 'TENANT'} />
    </>}
    <footer className={styles.footer}>Local synthetic demonstration · Amazon Bedrock is optional; without it the rule assistant answers. <a href="/guide">Walkthrough guide</a></footer>
  </main>;
}
