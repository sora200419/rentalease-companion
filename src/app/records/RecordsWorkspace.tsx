'use client';
import { useCallback, useEffect, useState } from 'react';
import { signIn, signOut } from 'next-auth/react';
import type { retrieveTenancyRecords, recordEvidenceAnswer, listAuthorizedTenancies } from '@/lib/companion/database';
import type { RecordsReply } from '@/lib/companion/records-model';
import styles from './records.module.css';
import RecordSubmissions from './RecordSubmissions';
type Listing = Awaited<ReturnType<typeof listAuthorizedTenancies>>;
type Detail = { records: Awaited<ReturnType<typeof retrieveTenancyRecords>>; answer: ReturnType<typeof recordEvidenceAnswer> };
const money = (sen: number) => new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR' }).format(sen / 100);

export default function RecordsWorkspace() {
  const [listing, setListing] = useState<Listing | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [signedOut, setSignedOut] = useState(false);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [topic, setTopic] = useState<'evidence' | 'refund'>('evidence');
  const [question, setQuestion] = useState('');
  const [reply, setReply] = useState<{ answer: RecordsReply; retrievedAt: string } | null>(null);
  const refresh = useCallback(async () => {
    setBusy(true); setError(''); setDetail(null); setListing(null); setReply(null); setQuestion('');
    try {
      const response = await fetch('/api/records', { cache: 'no-store' });
      if (response.status === 401) { setSignedOut(true); return; }
      if (!response.ok) throw new Error('Records are unavailable. Please retry.');
      setListing(await response.json()); setSignedOut(false);
    } catch (error) { setError(error instanceof Error ? error.message : 'Connection failed.'); }
    finally { setBusy(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  async function openTenancy(id: string) {
    setBusy(true); setError(''); setDetail(null); setTopic('evidence'); setReply(null); setQuestion('');
    try {
      const response = await fetch(`/api/records/${encodeURIComponent(id)}`, { cache: 'no-store' });
      if (response.status === 401) { setSignedOut(true); setListing(null); return; }
      if (!response.ok) throw new Error(response.status === 404 ? 'This tenancy is unavailable.' : 'Could not load the records. Please retry.');
      setDetail(await response.json());
    } catch (error) { setError(error instanceof Error ? error.message : 'Connection failed.'); }
    finally { setBusy(false); }
  }
  async function login(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    const form = event.currentTarget; const data = new FormData(form);
    try {
      const result = await signIn('credentials', { email: data.get('email'), password: data.get('password'), redirect: false, callbackUrl: '/records' });
      if (!result?.ok || result.error) throw new Error('Sign-in failed. Check your credentials or try again later.');
      form.reset(); await refresh();
    } catch (error) { setError(error instanceof Error ? error.message : 'Sign-in failed.'); }
    finally { setBusy(false); }
  }
  async function logout() {
    setBusy(true); setDetail(null); setListing(null); setError(''); setReply(null); setQuestion('');
    try { await signOut({ redirect: false }); setSignedOut(true); }
    catch { setError('Could not complete sign-out. Please retry.'); }
    finally { setBusy(false); }
  }
  async function ask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!detail) return;
    setBusy(true); setError(''); setReply(null);
    try {
      const response = await fetch(`/api/records/${encodeURIComponent(detail.records.tenancyId)}/question`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question }), cache: 'no-store',
      });
      if (response.status === 401) { setSignedOut(true); setListing(null); setDetail(null); return; }
      if (!response.ok) {
        if (response.status === 404) setDetail(null);
        throw new Error('Could not answer from current records. Refresh access and retry.');
      }
      setReply(await response.json());
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not retrieve records.'); }
    finally { setBusy(false); }
  }
  return <main className={styles.shell}>
    <header className={styles.header}><a href="/records" className={styles.brand}><i>re.</i> RentalEase <span>PRIVATE RECORDS</span></a><span className={styles.badge}>SUPABASE · CONFIRMED SUBMISSIONS</span></header>
    <div className={styles.body}>
      <p className={styles.eyebrow}>A CLEARER END TO YOUR TENANCY</p>
      <div className={styles.intro}><div><h1>Your records.<br /><em>One shared understanding.</em></h1><p>Source text, recorded amounts, and access tied to your account.</p></div>{listing && <button disabled={busy} onClick={logout} className={styles.secondary}>Sign out</button>}</div>
      <p className={styles.notice}>Development workspace · Synthetic accounts and records · No payments or AI-generated conclusions</p>
      {error && <p role="alert" className={styles.error}>{error}</p>}
      {busy && <p role="status">Loading securely…</p>}
      {signedOut ? <section className={styles.login}><div><p className={styles.eyebrow}>ACCOUNT ACCESS</p><h2>Welcome back.</h2><p>Use your development test account.<br />Your role comes from your account, not a switch.</p></div><form onSubmit={login}>
        <label htmlFor="records-email">Email</label><input id="records-email" name="email" type="email" autoComplete="username" required maxLength={254} />
        <label htmlFor="records-password">Password</label><input id="records-password" name="password" type="password" autoComplete="current-password" required maxLength={200} />
        <button disabled={busy} type="submit">Sign in to your records →</button><small>No registration or password reset in this development workspace.</small>
      </form></section> : <>
        <div className={styles.sectionHeading}><h2>Your tenancies</h2><button disabled={busy} className={styles.secondary} onClick={refresh}>Refresh access</button></div>
        {listing && <p className={styles.eyebrow}>SIGNED IN AS {listing.role}</p>}
        <div className={styles.tenancies}>{listing?.tenancies.map(t => <button disabled={busy} key={t.id} onClick={() => openTenancy(t.id)} aria-pressed={detail?.records.tenancyId === t.id}><strong>{t.room.label}</strong><span>{t.id}</span><small>{t.status} · View records ↗</small></button>)}</div>
        {listing?.tenancies.length === 0 && <p>No tenancies are available for this account.</p>}
        {detail && <section className={styles.detail}>
          <div className={styles.metrics}><div><span>RECORDED DEPOSIT</span><strong>{money(detail.records.depositSen)}</strong></div><div><span>RECORDED REFUND</span><strong>{detail.records.settlement ? money(detail.records.settlement.recordedRefundSen) : 'Not recorded'}</strong></div><div><span>SETTLEMENT STATUS</span><strong>{detail.records.settlement?.status ?? 'Not recorded'}</strong><small>Not independent proof of payment</small></div></div>
          <div className={styles.columns}><section><h2>Follow the source.</h2>{detail.records.evidence.map(e => <article className={styles.source} key={e.id} id={e.id}><div><strong>{e.kind.replaceAll('_', ' ')}</strong><span>{e.status}</span></div><p>{e.text ?? 'No written notes recorded.'}</p><small>{e.id}</small></article>)}{!detail.records.evidence.length && <p>No published reports available.</p>}
            {detail.records.agreement && <article className={styles.source}><div><strong>AGREEMENT</strong><span>{detail.records.agreement.status}</span></div><p>{detail.records.agreement.text}</p><small>{detail.records.agreement.id}</small></article>}</section>
          <aside className={styles.answer}><p className={styles.eyebrow}>RECORDS ASSISTANT · EXACT TEXT</p><h2>Read, then review.</h2><div className={styles.questions}><button aria-pressed={topic === 'evidence'} onClick={() => setTopic('evidence')}>Compare records</button><button aria-pressed={topic === 'refund'} onClick={() => setTopic('refund')}>Check recorded refund</button></div>
            <p className={styles.answerText}>{topic === 'evidence' ? detail.answer.text : detail.records.settlement ? `The database records a refund amount of ${money(detail.records.settlement.recordedRefundSen)} with status ${detail.records.settlement.status}. ${detail.records.settlement.paymentRecorded ? 'A payment date and PAID status are recorded; this is not independent verification of a bank transfer.' : 'No completed payment is established by this record.'} Chat cannot transfer money or submit a dispute. Use the separate review-and-confirm form below for submissions.` : 'No settlement record is available. No refund amount is inferred.'}</p>
            <form onSubmit={ask} className={styles.ask}><label htmlFor="record-question">Ask about this tenancy</label><input id="record-question" value={question} onChange={e => setQuestion(e.target.value)} maxLength={600} required placeholder="What refund and deductions are recorded?" disabled={busy} /><button disabled={busy || !question.trim()} type="submit">Find in current records →</button></form>
            {reply && <section aria-live="polite"><p className={styles.eyebrow}>DATABASE RECORDS · {reply.answer.selection === 'local-model' ? 'LOCAL AI SOURCE SELECTION' : 'RULE-BASED ANSWER'}</p>{reply.answer.notice && <p role="status">{reply.answer.notice}</p>}<p className={styles.answerText}>{reply.answer.text}</p><p className={styles.sources}>Sources: {reply.answer.sourceIds.join(', ') || 'No factual claim retrieved'}<br />Retrieved: {new Date(reply.retrievedAt).toLocaleTimeString('en-GB')}</p></section>}
            <small>Each question rechecks access and reads current records. Optional local AI selects source IDs only. No conversational memory or AI-generated conclusions.</small></aside></div>
          <RecordSubmissions key={detail.records.tenancyId} records={detail.records} busy={busy} setBusy={setBusy} reload={async () => {
            const response = await fetch(`/api/records/${encodeURIComponent(detail.records.tenancyId)}`, { cache: 'no-store' });
            if (!response.ok) throw new Error('Refresh failed.');
            setDetail(await response.json()); setReply(null);
          }} />
        </section>}
      </>}
      <footer className={styles.footer}>RentalEase Companion · Private by access, clear by evidence.</footer>
    </div>
  </main>;
}
