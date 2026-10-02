'use client';
import { useEffect, useRef, useState } from 'react';
import type { retrieveTenancyRecords } from '@/lib/companion/database';
import type { EvidenceFile } from '@/lib/companion/private-evidence';
import styles from './records.module.css';
type Records = Awaited<ReturnType<typeof retrieveTenancyRecords>>;
export default function PrivateEvidence({ records, busy, setBusy, onSaved }: { records: Records; busy: boolean; setBusy: (value:boolean) => void; onSaved?:()=>void }) {
  const [reportId,setReportId] = useState(records.evidence[0]?.id ?? '');
  const [files,setFiles] = useState<EvidenceFile[]>([]);
  const [file,setFile] = useState<File | null>(null);
  const [review,setReview] = useState(false);
  const [loading,setLoading] = useState(false);
  const [error,setError] = useState('');
  const [notice,setNotice] = useState('');
  const [refresh,setRefresh] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const endpoint = '/api/records/' + encodeURIComponent(records.tenancyId) + '/evidence?reportId=' + encodeURIComponent(reportId);
  useEffect(() => {
    if (!reportId) return;
    const abort = new AbortController();
    setLoading(true); setFiles([]); setError('');
    fetch(endpoint,{cache:'no-store',signal:abort.signal}).then(async response => {
      if (!response.ok) throw new Error('Could not load private files. Check your sign-in and retry.');
      const data = await response.json(); setFiles(data.files);
    }).catch(e => { if (!abort.signal.aborted) setError(e instanceof Error ? e.message : 'Private files unavailable.'); })
      .finally(() => { if (!abort.signal.aborted) setLoading(false); });
    return () => abort.abort();
  },[endpoint,reportId,refresh]);
  async function upload() {
    if (!file || !review) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch(endpoint,{
        method:'POST',headers:{'Content-Type':file.type,'x-file-name':encodeURIComponent(file.name),'x-confirm-upload':'true'},body:file,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Upload unavailable.');
      setNotice(data.replayed ? 'This file is already saved. No duplicate was created.' : 'Evidence saved. Both parties to this tenancy can download it.');
      setFile(null); setReview(false); if(input.current) input.current.value='';
      setRefresh(value=>value+1);
      onSaved?.();
    } catch(e) { setError(e instanceof Error ? e.message : 'Upload result uncertain. Retry the same file.'); }
    finally { setBusy(false); }
  }
  return <section className={styles.evidencePanel} aria-label="Private evidence files">
    <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>SHARED WITH YOUR TENANCY ONLY</p><h2>Keep the evidence together.</h2></div><span className={styles.privateBadge}>PRIVATE FILES</span></div>
    <p className={styles.help}>Attach test photos or PDFs to a published report. Files supplement the original record; their contents have not been verified or analysed by the assistant.</p>
    {records.evidence.length ? <>
      <label className={styles.fileLabel}>Related report<select value={reportId} disabled={busy || review} onChange={e=>{setReportId(e.target.value);setFile(null);setReview(false);setNotice('');if(input.current)input.current.value='';}}>
        {records.evidence.map(report=><option value={report.id} key={report.id}>{report.kind.replaceAll('_',' ')} · {report.id}</option>)}
      </select></label>
      <div className={styles.fileLayout}><div className={styles.filePicker}>
        <label htmlFor="private-evidence-file">Choose evidence<input ref={input} id="private-evidence-file" type="file" accept="image/png,image/jpeg,application/pdf" disabled={busy || review} onChange={e=>{
          const selected=e.target.files?.[0]??null;setError('');setNotice('');
          if(selected && (!['image/png','image/jpeg','application/pdf'].includes(selected.type)||selected.size>5*1024*1024||!selected.size)){
            setError('Choose a non-empty PNG, JPEG or PDF up to 5 MB.');setFile(null);e.target.value='';return;
          }setFile(selected);
        }}/></label>
        <p className={styles.help}>PNG, JPEG or PDF · Up to 5 MB each · 50 files per report</p>
        {!review ? <button disabled={busy||!file||loading} onClick={()=>setReview(true)}>Review upload →</button> : <div className={styles.fileReview}>
          <strong>{file?.name}</strong><p>{((file?.size??0)/1024).toFixed(1)} KB · {reportId}</p>
          <p>This will share the selected file with the tenant and landlord of this tenancy. Existing files are retained.</p>
          <div className={styles.questions}><button disabled={busy} onClick={upload}>Confirm and upload</button><button className={styles.secondary} disabled={busy} onClick={()=>setReview(false)}>Cancel</button></div>
        </div>}
      </div><div>
        <div className={styles.fileListHeading}><h3>Attached files</h3><button className={styles.secondary} disabled={busy||loading} onClick={()=>setRefresh(value=>value+1)}>Refresh files</button></div>
        {loading ? <p role="status">Loading private files…</p> : files.length ? <ul className={styles.fileList}>{files.map(item=><li key={item.key}>
          <a href={endpoint+'&file='+encodeURIComponent(item.key)} download>{item.name} <span aria-hidden="true">↓</span></a>
          <small>{(item.size/1024).toFixed(1)} KB · {item.uploadedBy.endsWith('landlord')?'Landlord':'Tenant'} · {new Date(item.uploadedAt).toLocaleString('en-GB')}</small>
        </li>)}</ul> : <p className={styles.help}>No attachments on this report yet.</p>}
      </div></div>
    </> : <p>Submit a condition report first, then attach its evidence here.</p>}
    {error&&<p role="alert" className={styles.error}>{error}</p>}
    {notice&&<p role="status" className={styles.receipt}>{notice}</p>}
  </section>;
}
