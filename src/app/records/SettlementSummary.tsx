'use client';
import { useState } from 'react';
import { settlementSummary } from '@/lib/companion/records-summary';
import { money, type Records } from '@/lib/companion/records-workflow';
import styles from './summary.module.css';

export default function SettlementSummary({ records, busy, onSelect }: { records: Records; busy: boolean; onSelect: (id: string) => void }) {
  const summary = settlementSummary(records);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');
  const [requested, setRequested] = useState(false);
  async function download() {
    setDownloading(true); setError(''); setRequested(false);
    try {
      const response = await fetch('/api/records/' + encodeURIComponent(records.tenancyId) + '/summary', { cache: 'no-store' });
      if (!response.ok) throw new Error(response.status === 401 ? 'Your session has expired. Sign in again before downloading.' : 'Could not download the current summary. Refresh access and retry.');
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = url; link.download = /filename="([^"]+)"/.exec(response.headers.get('content-disposition') ?? '')?.[1] ?? 'rentalease-summary.txt';
      document.body.appendChild(link); link.click(); link.remove();
      setRequested(true);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Download failed. Please retry.'); }
    finally { setDownloading(false); }
  }
  return <section className={styles.summary} aria-labelledby="summary-heading">
    <div className={styles.heading}>
      <div><p className={styles.eyebrow}>THE REVIEW AT A GLANCE · REVISION {records.revision}</p><h2 id="summary-heading">{summary.title}</h2><p>{summary.resolvedCount} of {summary.items.length} deductions resolved. {summary.paymentNotice}</p></div>
      <button type="button" disabled={busy || downloading} onClick={download}>{downloading ? 'Preparing summary…' : 'Download current summary ↓'}</button>
    </div>
    {summary.warnings.map(warning => <p className={styles.warning} key={warning} role="alert">{warning}</p>)}
    <ol className={styles.items}>{summary.items.map(item => <li key={item.id}>
      <span className={styles.number}>{String(item.number).padStart(2, '0')}</span>
      <div><strong>{item.reason}</strong><p>{item.next}</p>{item.pendingAmountSen !== null && <p className={styles.proposal}>Pending proposal: {money(item.pendingAmountSen)} · not applied</p>}<small>{item.sources.length} linked file reference{item.sources.length === 1 ? '' : 's'}</small></div>
      <div className={styles.amount}><strong>{money(item.contributionSen)}</strong><small>{item.status === 'WITHDRAWN' ? 'Withdrawn · excluded' : item.status === 'ACCEPTED' ? 'Accepted' : 'Current recorded amount'}</small>
        <button type="button" disabled={busy} onClick={() => { onSelect(item.id); document.getElementById('deduction-review')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>Review item {item.number} ↗</button>
      </div>
    </li>)}</ol>
    <div className={styles.total}><span>Current total deductions</span><strong>{records.settlement ? money(summary.totalSen) : 'Not recorded'}</strong></div>
    <p className={styles.footnote}>The download rechecks access and reads the latest saved revision. It includes source references and decision history, not private file contents. Downloaded copies are no longer protected by the app’s sign-in.</p>
    {error && <p role="alert" className={styles.warning}>{error}</p>}
    {requested && <p role="status" className={styles.footnote}>Download requested. Check your browser’s downloads for the summary text file.</p>}
  </section>;
}
