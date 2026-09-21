'use client';

import { useEffect, useRef, useState } from 'react';
import { actors, initialState, money, type ActionKind, type DemoState, type Role, type Source } from '@/lib/companion/demo';
import styles from './companion.module.css';

type Snapshot = { revision: number; role: Role; state: DemoState; evidence: Source[];
  settlement: { depositSen: number; proposedDeductionSen: number; proposedRefundSen: number };
  configuredProvider: 'rules' | 'ollama'; notice?: string };
let initializing: Promise<Snapshot> | undefined;
async function readSession(resume = false): Promise<Snapshot> {
  const response = await fetch('/api/companion/session', { cache: 'no-store' });
  if (!response.ok) throw new Error('The local companion service is unavailable. Start it with npm run dev:companion.');
  if (!resume) return response.json() as Promise<Snapshot>;
  const resumed = await fetch('/api/companion/resume', { method: 'POST' });
  if (!resumed.ok) throw new Error('Could not restore your demo session. Please reload.');
  return resumed.json() as Promise<Snapshot>;
}
const statusLabels = { PROPOSED: 'Awaiting your review', DISPUTED: 'Dispute submitted', WITHDRAWN: 'Deduction withdrawn' };

function RoomIllustration({ moveOut }: { moveOut: boolean }) {
  return <svg viewBox="0 0 400 230" role="img" aria-label={`Synthetic ${moveOut ? 'move-out' : 'move-in'} bedroom illustration with a wall mark; not a real evidence photo`}>
    <rect width="400" height="230" fill={moveOut ? '#d3d6c8' : '#dfded1'} />
    <path d="M0 0H75V175L0 230Z" fill="#bec6b8" /><path d="M75 175H400V230H0Z" fill="#b6a58a" />
    <path d="M75 175H400M75 0V175" stroke="#8f9a8a" strokeWidth="2" />
    <rect x="201" y="29" width="114" height="88" fill="#f5f3e9" /><rect x="208" y="36" width="100" height="74" fill="#a9bec0" />
    <path d="M258 36V110M208 73H308" stroke="#f5f3e9" strokeWidth="5" />
    <path d="M222 143L244 148L253 145" stroke="#827563" strokeWidth="3" fill="none" />
    <circle cx="239" cy="145" r="26" stroke="#ad632d" strokeWidth="1.7" fill="none" strokeDasharray="4 4" />
    {!moveOut && <><path d="M43 165L158 159L188 207L60 220Z" fill="#ebe7da" /><path d="M43 165V191L60 220V186Z" fill="#8d9588" /><rect x="59" y="151" width="67" height="18" rx="7" fill="#f4f0e6" /></>}
    <rect x="14" y="12" width="102" height="23" rx="3" fill="#263e35" /><text x="23" y="28" fill="#fff" fontSize="10" letterSpacing="1.5">ILLUSTRATION</text>
  </svg>;
}

function SourceCard({ source }: { source: Source }) {
  return <article id={`source-${source.id}`} className={styles.sourceCard} tabIndex={-1}>
    <div className={styles.sourceTop}><span className={styles.sourceId}>{source.id}</span><span className={styles.sourceStatus}>{source.status.replaceAll('_', ' ')}</span></div>
    {source.kind !== 'AGREEMENT' && <div className={styles.roomImage}><RoomIllustration moveOut={source.kind === 'MOVE_OUT'} /></div>}
    <div className={styles.sourceBody}><div className={styles.sourceDate}>{source.date}</div><h3>{source.title}</h3><p>{source.text}</p></div>
  </article>;
}

export default function CompanionDemo() {
  const [state, setState] = useState<DemoState>(() => initialState());
  const [role, setRole] = useState<Role>('TENANT');
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const [evidence, setEvidence] = useState<Source[]>([]);
  const [context, setContext] = useState({ depositSen: 240000, proposedDeductionSen: 30000, proposedRefundSen: 210000 });
  const [provider, setProvider] = useState<'rules' | 'ollama'>('rules');
  const [question, setQuestion] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [resetOpen, setResetOpen] = useState(false);
  const [baseline, setBaseline] = useState<DemoState['baseline']>('ACCEPTED');
  const conversation = useRef<HTMLDivElement>(null);
  const requestRunning = useRef(false);
  const actor = actors[role];
  const messages = state.entries.filter(entry => entry.role === role);

  function applySnapshot(value: Snapshot) {
    setState(value.state); setRole(value.role); setRevision(value.revision);
    setEvidence(value.evidence); setContext(value.settlement); setProvider(value.configuredProvider);
    setNotice(value.notice ?? ''); setReady(true);
  }

  useEffect(() => {
    let active = true;
    // Share only concurrent initialization, so React development checks do not create two sessions.
    initializing ??= readSession(true).finally(() => { initializing = undefined; });
    void initializing.then(value => { if (active) applySnapshot(value); }).catch(caught => {
      if (active) setError(caught instanceof Error ? caught.message : 'Could not restore the session.');
    });
    return () => { active = false; };
  }, []);
  useEffect(() => { conversation.current?.scrollTo({ top: conversation.current.scrollHeight, behavior: 'smooth' }); }, [state.entries, role]);

  async function run(operation: string, payload: Record<string, unknown> = {}) {
    if (!ready || requestRunning.current) return false;
    requestRunning.current = true; setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch(`/api/companion/${operation}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ revision, ...payload }) });
      const value = await response.json() as Snapshot & { error?: string };
      if (!response.ok) {
        if (response.status === 409 || response.status === 401) applySnapshot(await readSession());
        throw new Error(value.error ?? 'The request failed. Please try again.');
      }
      applySnapshot(value); return true;
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Connection failed. Your action was not confirmed here. Refresh to check its status.'); return false; }
    finally { requestRunning.current = false; setBusy(false); }
  }
  async function ask(text: string) {
    const clean = text.trim().slice(0, 1000);
    if (!clean || !ready) return;
    if (await run('chat', { question: clean })) setQuestion('');
  }
  function prepare(kind: ActionKind) {
    void run('prepare', { kind });
  }
  function confirm() {
    if (!state.pending) return;
    void run('confirm', { actionId: state.pending.id });
  }
  function switchRole(nextRole: Role) {
    void run('role', { role: nextRole }).then(ok => { if (ok) setQuestion(''); });
  }
  function jumpToSource(id: string) {
    const element = document.getElementById(`source-${id}`);
    element?.scrollIntoView({ behavior: 'smooth', block: 'center' }); element?.focus({ preventScroll: true });
  }

  return <main className={styles.app}>
    <aside className={styles.sidebar}>
      <a className={styles.brand} href="/companion"><span className={styles.brandMark}>re.</span><span>RentalEase<span className={styles.brandSub}>MOVE-OUT COMPANION</span></span></a>
      <div className={styles.workspaceLabel}>YOUR WORKSPACE</div>
      <a className={styles.navActive} href="#case"><span aria-hidden="true">▤</span> Deposit review <span className={styles.navCount}>01</span></a>
      <a className={styles.navItem} href="#evidence"><span aria-hidden="true">▧</span> Evidence library</a>
      <a className={styles.navItem} href="#activity"><span aria-hidden="true">◷</span> Activity record</a>
      <div className={styles.sidebarNote}><span className={styles.eyebrow}>A CLEARER HANDOVER</span><p>Every claim has a source.<br />Every action is yours.</p><div className={styles.noteLine} /></div>
      <div className={styles.profile}><span className={styles.avatar}>{role === 'TENANT' ? 'AR' : 'DL'}</span><div><strong>{actor.name}</strong><span>{role === 'TENANT' ? 'Tenant' : 'Landlord'} · demo profile</span></div></div>
    </aside>
    <div className={styles.workspace}>
      <header className={styles.topbar}><span>Workspace <span className={styles.slash}>/</span> Move-out review</span><span className={styles.localBadge}><span /> Local demo · no cloud calls</span></header>
      <div className={styles.content}>
        <div className={styles.demoNotice}>Alexa+ experience prototype <span>·</span> Synthetic records & illustrations <span>·</span> {provider === 'ollama' ? 'Local AI configured' : 'Rule-based assistant'}</div>
        <section id="case" className={styles.heading}>
          <div><div className={styles.eyebrow}>CASE RE–001 / SEPTEMBER 2026</div><h1>A fair finish.<br /><em>A clearer next step.</em></h1><p>Review the evidence. Resolve the deposit. Move forward.</p></div>
          <div className={styles.roleSwitch}><span>Explore as</span><div role="group" aria-label="Demo role"><button aria-pressed={role === 'TENANT'} onClick={() => switchRole('TENANT')} disabled={!ready || busy}>Tenant</button><button aria-pressed={role === 'LANDLORD'} onClick={() => switchRole('LANDLORD')} disabled={!ready || busy}>Landlord</button></div></div>
        </section>
        {!ready && !error && <p role="status">Restoring your local session…</p>}
        {error && <p role="alert" className={styles.warning}>{error}</p>}
        {notice && <p role="status" className={styles.warning}>{notice}</p>}
        <section className={styles.summary} aria-label="Settlement summary">
          <div className={styles.property}><div className={styles.houseIcon} aria-hidden="true">⌂</div><div><span className={styles.eyebrow}>DEMO TENANCY · UNIT 08–12</span><h2>The Fern Residences</h2><p>Bedroom A · Kuala Lumpur</p></div></div>
          <div className={styles.metric}><span>Deposit held</span><strong>{money(context.depositSen)}</strong></div>
          <div className={styles.metric}><span>Proposed deduction</span><strong className={state.status === 'WITHDRAWN' ? '' : styles.amber}>{money(context.proposedDeductionSen)}</strong></div>
          <div className={styles.metric}><span>Proposed refund</span><strong>{money(context.proposedRefundSen)}</strong><small>Not a payment confirmation</small></div>
        </section>
        <div className={styles.mainGrid}>
          <div className={styles.caseColumn}>
            <section className={styles.deduction}>
              <div className={styles.sectionTop}><span className={styles.eyebrow}>DEDUCTION 01</span><span className={`${styles.status} ${state.status === 'WITHDRAWN' ? styles.resolved : ''}`} role="status">{statusLabels[state.status]}</span></div>
              <h2>Bedroom wall repainting <span>RM300</span></h2><p>A scuff below the window. Was it already there at move-in?</p>
              <div className={styles.finding}><span aria-hidden="true">↳</span><div><strong>{state.baseline === 'MISSING' ? 'The starting point is missing' : state.baseline === 'DISPUTED' ? 'The starting point is disputed' : 'A relevant earlier record exists'}</strong><p>{state.baseline === 'ACCEPTED' ? 'The accepted move-in report mentions a mark in this area. Compare the records before deciding what happens next.' : 'The available records do not establish a reliable baseline. Further evidence is needed before reaching a conclusion.'}</p></div></div>
            </section>
            <section id="evidence" className={styles.evidenceSection}>
              <div className={styles.sectionHeading}><h2>Follow the evidence</h2><span>{evidence.length} linked sources</span></div>
              <p className={styles.sectionCaption}>Source text is available below. Illustrations show the demo scene; they are not inspected photographs.</p>
              <div className={styles.evidenceGrid}>{evidence.filter(s => s.kind !== 'AGREEMENT').map(source => <SourceCard key={source.id} source={source} />)}{state.baseline === 'MISSING' && <div className={styles.missing}><strong>No move-in report</strong><p>No baseline observation can be made.</p></div>}</div>
              {evidence.filter(s => s.kind === 'AGREEMENT').map(source => <SourceCard key={source.id} source={source} />)}
            </section>
            <section id="activity" className={styles.activity}><div className={styles.sectionHeading}><h2>Activity record</h2><span>Saved on your computer</span></div><ol>{state.activity.map((item, index) => <li key={`${index}-${item}`}><span className={styles.activityDot} /><p>{item}</p></li>)}</ol></section>
          </div>
          <aside className={styles.assistant} aria-label="Move-out assistant">
            <div className={styles.assistantHeader}><span className={styles.assistantGlyph} aria-hidden="true">✳</span><div><h2>Your move-out companion</h2><span>Evidence first. You decide.</span></div></div>
            <div className={styles.assistantMode}>{provider === 'ollama' ? 'LOCAL AI · OLLAMA' : 'RULE-BASED MODE'} <span>{busy ? 'Processing your request…' : 'No cloud calls or photo analysis'}</span></div>
            <div className={styles.conversation} ref={conversation} role="log" aria-label="Conversation" aria-live="polite">
              <div className={styles.assistantMessage}><span className={styles.messageLabel}>COMPANION</span><p>{role === 'TENANT' ? 'Let’s take a closer look at the RM300 wall deduction. I can bring together the records and help you prepare a response.' : 'You can review the tenant’s response and the linked records, then decide whether to withdraw the deduction.'}</p><p className={styles.messageAside}>This demo organizes evidence. It does not decide legal responsibility.</p></div>
              {messages.map(entry => <div key={entry.id} className={entry.speaker === 'USER' ? styles.userMessage : styles.assistantMessage}><span className={styles.messageLabel}>{entry.speaker === 'USER' ? actor.name : entry.provider === 'ollama' ? 'COMPANION · LOCAL AI' : 'COMPANION · RULE-BASED'}</span><p>{entry.text}</p>{entry.sourceIds.length > 0 && <div className={styles.citations}>{entry.sourceIds.map(id => <button key={id} onClick={() => jumpToSource(id)} aria-label={`View source ${id}`}>{id} ↗</button>)}</div>}</div>)}
            </div>
            <div className={styles.suggestions}><button disabled={!ready || busy} onClick={() => { void ask('Compare the wall evidence'); }}>Compare evidence ↗</button><button disabled={!ready || busy} onClick={() => { void ask('What is my deposit status?'); }}>Check deposit ↗</button></div>
            <form className={styles.composer} onSubmit={event => { event.preventDefault(); void ask(question); }}><label htmlFor="companion-question" className={styles.srOnly}>Ask about the demo settlement</label><input id="companion-question" value={question} onChange={event => setQuestion(event.target.value)} maxLength={1000} placeholder="Ask about this deduction…" disabled={!ready || busy} /><button aria-label="Send message" disabled={!ready || busy || !question.trim()} type="submit">↑</button></form>
            <div className={styles.actionArea}>
              {state.pending ? <div className={styles.confirmation} aria-label="Review action before confirming"><span className={styles.eyebrow}>REVIEW BEFORE CONFIRMING</span><h3>{state.pending.kind === 'DISPUTE' ? 'Submit this dispute?' : 'Withdraw this deduction?'}</h3><p>{state.pending.draft}</p><small>Acts as {actor.name}. Local demo only. Confirmation expires after 5 minutes.</small><div className={styles.confirmButtons}><button disabled={busy} onClick={() => { void run('cancel'); }}>Cancel</button><button disabled={busy} className={styles.primaryButton} onClick={confirm}>{state.pending.kind === 'DISPUTE' ? 'Confirm dispute' : 'Confirm withdrawal'}</button></div></div>
                : state.status === 'WITHDRAWN' ? <div className={styles.complete}><strong>Ready for the next chapter.</strong><p>The deduction is withdrawn. Proposed refund: RM2,400. Payment remains a separate step.</p></div>
                  : role === 'TENANT' && state.status === 'DISPUTED' ? <div className={styles.complete}><strong>Your response is recorded.</strong><p>Switch to the landlord demo profile to review the dispute.</p></div>
                    : <><p>Nothing is submitted until you confirm.</p><button className={styles.primaryButton} disabled={!ready || busy} onClick={() => prepare(role === 'TENANT' ? 'DISPUTE' : 'WITHDRAW')}>{role === 'TENANT' ? 'Prepare a dispute' : 'Review withdrawal'} <span aria-hidden="true">→</span></button></>}
            </div>
          </aside>
        </div>
        <footer className={styles.footer}><p>RentalEase Companion · Independent Alexa+ simulation prototype</p><button onClick={() => { setBaseline(state.baseline); setResetOpen(true); }} disabled={!ready || busy}>Reset / change demo scenario</button></footer>
        {resetOpen && <section className={styles.resetPanel} aria-label="Reset demo confirmation"><h2>Start a fresh demo</h2><p>This clears the conversation and actions in your current demo session.</p><label htmlFor="baseline">Move-in baseline</label><select id="baseline" value={baseline} onChange={event => setBaseline(event.target.value as DemoState['baseline'])} disabled={busy}><option value="ACCEPTED">Accepted report</option><option value="DISPUTED">Disputed report</option><option value="MISSING">Missing report</option></select><div className={styles.confirmButtons}><button disabled={busy} onClick={() => setResetOpen(false)}>Keep current demo</button><button disabled={busy} className={styles.primaryButton} onClick={() => { void run('reset', { baseline }).then(ok => { if (ok) { setQuestion(''); setResetOpen(false); } }); }}>Reset demo</button></div></section>}
      </div>
    </div>
  </main>;
}
