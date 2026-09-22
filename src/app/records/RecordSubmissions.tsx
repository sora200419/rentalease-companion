'use client';
import { useState } from 'react';
import type { retrieveTenancyRecords } from '@/lib/companion/database';
import type { ActionInput, prepareActionToken } from '@/lib/companion/records-actions';
import styles from './records.module.css';
type Records = Awaited<ReturnType<typeof retrieveTenancyRecords>>;
type Props = { records: Records; busy: boolean; setBusy: (value: boolean) => void; reload: () => Promise<void> };

export default function RecordSubmissions({ records, busy, setBusy, reload }: Props) {
  const [kind, setKind] = useState<ActionInput['kind']>('REPORT');
  const [reportType, setReportType] = useState<'MOVE_IN' | 'MOVE_OUT' | 'INSPECTION'>('MOVE_OUT');
  const [target, setTarget] = useState('');
  const [text, setText] = useState('');
  const [prepared, setPrepared] = useState<ReturnType<typeof prepareActionToken> | null>(null);
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState('');
  const deductions = records.settlement?.deductions.filter(d => d.status === 'PROPOSED') ?? [];
  const disputes = records.history.filter(e => e.kind === 'DISPUTE');
  async function send(body: object) {
    const response = await fetch(`/api/records/${encodeURIComponent(records.tenancyId)}/actions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Submission unavailable.');
    return data;
  }
  async function prepare(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(''); setReceipt('');
    const payload = kind === 'REPORT' ? { text, reportType } : kind === 'DISPUTE' ? { text, deductionId: target } : { text, disputeId: target };
    try { setPrepared(await send({ operation: 'prepare', action: { kind, payload } })); }
    catch (e) { setError(e instanceof TypeError ? 'Could not load the preview. Nothing has been submitted; please retry.' : e instanceof Error ? e.message : 'Could not prepare.'); }
    finally { setBusy(false); }
  }
  async function confirm() {
    if (!prepared) return;
    setBusy(true); setError('');
    try {
      const data = await send({ operation: 'confirm', confirmed: true, token: prepared.token });
      setReceipt(`Saved to Supabase. Reference: ${data.receipt.id}${data.receipt.replayed ? ' (existing submission; not duplicated)' : ''}.`);
      setPrepared(null); setText(''); setTarget(''); setKind('REPORT');
      try { await reload(); } catch { setError('Submission was saved, but the latest records could not be loaded. Refresh access to view them.'); }
    } catch (e) { setError(e instanceof TypeError ? 'Result uncertain. Retry this same confirmation, or check history before creating another submission.' : e instanceof Error ? e.message : 'Result uncertain. Retry the same confirmation to avoid duplicates.'); }
    finally { setBusy(false); }
  }
  return <section className={styles.submissions}>
    <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>YOUR NEXT STEP · SAVED IN SUPABASE</p><h2>Review before you send.</h2></div><span className={styles.eyebrow}>REVISION {records.revision}</span></div>
    <p className={styles.help}>Only synthetic development records are enabled. Submissions are shared with the other party and retained in history. No payment or refund amount changes.</p>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {receipt && <p role="status" className={styles.receipt}>{receipt}</p>}
    {prepared ? <section className={styles.preview} aria-label="Submission preview">
      <p className={styles.eyebrow}>NOT SAVED YET · CONFIRM WITHIN 10 MINUTES</p><h3>{prepared.preview.kind === 'REPORT' ? 'Submit condition report' : prepared.preview.kind === 'DISPUTE' ? 'Submit deduction dispute' : 'Send landlord response'}</h3>
      <p>Tenancy: {records.tenancyId}<br />Type / target: {prepared.preview.payload.reportType ?? prepared.preview.payload.deductionId ?? prepared.preview.payload.disputeId}</p>
      <blockquote>{prepared.preview.payload.text}</blockquote>
      <p>{prepared.preview.kind === 'DISPUTE' ? 'This marks the selected deduction and settlement as DISPUTED. It does not decide liability or change any amounts.' : prepared.preview.kind === 'RESPONSE' ? 'This adds your response to the history. It does not close the dispute or mark it as agreed.' : 'This creates a new SUBMITTED text report. It does not replace an earlier report or mean the other party accepts it.'}</p>
      <div className={styles.questions}><button disabled={busy} onClick={confirm}>Confirm and save to Supabase</button><button className={styles.secondary} disabled={busy} onClick={() => { setPrepared(null); setError(''); }}>Edit / cancel preview</button></div>
    </section> : <form className={styles.submissionForm} onSubmit={prepare}>
      <label>Action<select value={kind} disabled={busy} onChange={e => { setKind(e.target.value as ActionInput['kind']); setTarget(''); setError(''); }}>
        <option value="REPORT">Submit a condition report</option>
        {records.role === 'TENANT' && deductions.length > 0 && !['AGREED','PAID'].includes(records.settlement?.status ?? '') && <option value="DISPUTE">Dispute a proposed deduction</option>}
        {records.role === 'LANDLORD' && disputes.length > 0 && <option value="RESPONSE">Respond to a dispute</option>}
      </select></label>
      {kind === 'REPORT' ? <label>Report type<select value={reportType} disabled={busy} onChange={e => setReportType(e.target.value as typeof reportType)}><option value="MOVE_OUT">Move-out</option><option value="MOVE_IN">Move-in</option><option value="INSPECTION">Inspection</option></select></label>
        : <label>{kind === 'DISPUTE' ? 'Proposed deduction' : 'Dispute to respond to'}<select required value={target} disabled={busy} onChange={e => setTarget(e.target.value)}><option value="">Select a record</option>{kind === 'DISPUTE' ? deductions.map(d => <option key={d.id} value={d.id}>{d.reason} · MYR {(d.amountSen / 100).toFixed(2)}</option>) : disputes.map(d => <option key={d.id} value={d.id}>{d.payload.text.slice(0,80)} · {d.id}</option>)}</select></label>}
      <label className={styles.wide}>Your {kind === 'REPORT' ? 'observations' : 'message'}<textarea value={text} onChange={e => setText(e.target.value)} disabled={busy} minLength={10} maxLength={2000} required rows={4} placeholder="Describe what you observed and refer to the relevant records. Use test information only." /></label>
      <div className={styles.wide}><button disabled={busy || text.trim().length < 10} type="submit">Review submission →</button><span className={styles.help}> {text.length}/2000 · Nothing is saved until you confirm.</span></div>
    </form>}
    <section className={styles.history} aria-label="Submission history"><h3>Submission history</h3><p className={styles.help}>Latest 50 submissions. Earlier reports and messages are not overwritten. A landlord response does not resolve a dispute.</p>
      {records.history.length === 0 && <p>No submissions yet.</p>}
      {records.history.map(e => <article key={e.id}><div><strong>{e.kind.replaceAll('_',' ')}</strong><span>Revision {e.revision} · {new Date(e.createdAt).toLocaleString('en-GB')}</span></div><p>{e.payload.text}</p><small>{e.actorId} · {e.id}{e.payload.deductionId ? ` · Deduction: ${e.payload.deductionId}` : ''}{e.payload.disputeId ? ` · Reply to: ${e.payload.disputeId}` : ''}</small></article>)}
    </section>
  </section>;
}
