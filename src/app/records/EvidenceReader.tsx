'use client';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import type { Records } from '@/lib/companion/records-workflow';
import type { EvidenceFile } from '@/lib/companion/private-evidence';
import type { prepareActionToken } from '@/lib/companion/records-actions';
import { fileHref } from '@/lib/companion/records-evidence';
import styles from './records.module.css';
type FileItem=EvidenceFile&{reportId:string;reportKind:string};
const selectionKey=(f:FileItem)=>f.reportId+'/'+f.key;
const selectionKeyOrEmpty=(f?:FileItem)=>f?selectionKey(f):'';
type Props={records:Records;selected:string;busy:boolean;setBusy:(v:boolean)=>void;reload:()=>Promise<void>;version:number};
export default function EvidenceReader({records,selected,busy,setBusy,reload,version}:Props) {
 const [files,setFiles]=useState<FileItem[]>([]); const [loading,setLoading]=useState(false);
 const [error,setError]=useState('');const [notice,setNotice]=useState('');
 const [pair,setPair]=useState<string[]>(['','']);
 const [prepared,setPrepared]=useState<ReturnType<typeof prepareActionToken>|null>(null);
 const [refresh,setRefresh]=useState(0);
 useEffect(()=>{setPrepared(null);setNotice('');},[selected]);
 const reportKey=records.evidence.map(r=>r.id).join('|');
 useEffect(()=>{
  const abort=new AbortController();setLoading(true);setError('');
  // Sequential reads avoid opening many simultaneous database connections.
  void(async()=>{
   const result:FileItem[]=[];
   try{
    for(const report of records.evidence){
     const response=await fetch('/api/records/'+encodeURIComponent(records.tenancyId)+'/evidence?reportId='+encodeURIComponent(report.id),{cache:'no-store',signal:abort.signal});
     if(!response.ok)throw new Error('Some evidence could not be loaded. Refresh files to retry.');
     const data=await response.json();
     result.push(...data.files.map((f:EvidenceFile)=>({...f,reportId:report.id,reportKind:report.kind})));
    }
    if(abort.signal.aborted)return;
    setFiles(result);
   }catch(e){if(!abort.signal.aborted){setFiles([]);setError(e instanceof Error?e.message:'Evidence unavailable.');}}
   finally{if(!abort.signal.aborted)setLoading(false);}
  })();
  return()=>abort.abort();
  // Report content updates do not change the storage locations.
  // eslint-disable-next-line react-hooks/exhaustive-deps
 },[records.tenancyId,reportKey,version,refresh]);
 const deduction=records.settlement?.deductions.find(d=>d.id===selected);
 const links=records.history.filter(e=>e.kind==='EVIDENCE_LINK'&&e.payload.deductionId===selected);
 const linked=(f:FileItem)=>links.some(e=>e.payload.reportId===f.reportId&&e.payload.fileKey===f.key);
 const linkedKey=links.map(e=>e.payload.reportId+'/'+e.payload.fileKey).sort().join('|');
 useEffect(()=>{
  const keys=new Set(linkedKey.split('|'));
  // Prefer the selected deduction's references. Without any linked photos,
  // leave both slots empty instead of implying that another item's photo fits.
  const photos=files.filter(f=>!f.name.endsWith('.pdf')&&keys.has(selectionKey(f)));
  setPair(['MOVE_IN','MOVE_OUT'].map(kind=>selectionKeyOrEmpty(photos.find(f=>f.reportKind===kind))));
 },[files,selected,linkedKey]);
 async function action(body:object){
  const response=await fetch('/api/records/'+encodeURIComponent(records.tenancyId)+'/actions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const data=await response.json();if(!response.ok)throw new Error(data.error??'Could not save this reference.');return data;
 }
 async function prepare(f:FileItem){
  if(!deduction)return;setBusy(true);setError('');setNotice('');
  try{setPrepared(await action({operation:'prepare',action:{kind:'EVIDENCE_LINK',payload:{deductionId:deduction.id,reportId:f.reportId,fileKey:f.key,text:'Evidence reference: '+f.name+' from '+f.reportKind.replaceAll('_',' ')+' report.'}}}));}
  catch(e){setError(e instanceof Error?e.message:'Reference unavailable.');}finally{setBusy(false);}
 }
 async function confirm(){
  if(!prepared)return;setBusy(true);setError('');
  try{
   const data=await action({operation:'confirm',confirmed:true,token:prepared.token});
   setPrepared(null);setNotice('File linked to this deduction. Reference: '+data.receipt.id);
   try{await reload();}catch{setError('Link saved. Refresh access to load the latest references.');}
  }catch(e){setError(e instanceof Error?e.message:'Result uncertain. Retry this confirmation.');}finally{setBusy(false);}
 }
 return <section className={styles.evidenceReader} aria-label="Evidence comparison">
  <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>THE RECORD, SIDE BY SIDE</p><h2>Look closer at the evidence.</h2></div><button className={styles.secondary} disabled={busy||loading} onClick={()=>setRefresh(v=>v+1)}>Refresh files</button></div>
  <p className={styles.help}>{deduction?'References for: '+deduction.reason:'Select a deduction to link supporting files.'} Upload dates describe when files were saved; they do not establish when a photo was taken.</p>
  {error&&<p role="alert" className={styles.error}>{error}</p>}{notice&&<p role="status" className={styles.receipt}>{notice}</p>}
  {loading?<p role="status">Loading private evidence…</p>:<>
   <div className={styles.comparisonGrid}>{[0,1].map(i=>{
    const f=files.find(file=>selectionKey(file)===pair[i]);
    return <figure key={i} className={styles.photoPanel}><label>{i===0?'Move-in / earlier evidence':'Move-out / later evidence'}<select aria-label={i===0?'Earlier photo':'Later photo'} value={pair[i]} onChange={e=>setPair(p=>p.map((value,index)=>index===i?e.target.value:value))}><option value="">Choose a photo</option>{files.filter(file=>!file.name.endsWith('.pdf')).map(file=><option key={selectionKey(file)} value={selectionKey(file)}>{file.reportKind.replaceAll('_',' ')} · {file.name}</option>)}</select></label>
     {f?<><Image unoptimized width={800} height={600} key={selectionKey(f)} src={fileHref(records.tenancyId,f.reportId,f.key,true)} alt={f.reportKind.replaceAll('_',' ')+' evidence: '+f.name} onError={e=>{e.currentTarget.hidden=true;setError('A photo preview is unavailable. Refresh access or download the source file.');}}/><figcaption><strong>{f.name}</strong><span>{f.reportKind.replaceAll('_',' ')} · {f.reportId}</span><small>Uploaded {new Date(f.uploadedAt).toLocaleString('en-GB')}</small><a href={fileHref(records.tenancyId,f.reportId,f.key)}>Download original ↗</a></figcaption></>:<div className={styles.emptyPhoto}>No photo selected.<br/>Upload a test photo to its condition report below.</div>}
    </figure>;
   })}</div>
   <h3>Files and deduction references</h3>
   {files.length===0&&<p>No files have been uploaded yet.</p>}
   <ul className={styles.evidenceFiles}>{files.map(f=><li key={selectionKey(f)}><div><a href={fileHref(records.tenancyId,f.reportId,f.key)}>{f.name} ↗</a><small>{f.reportKind.replaceAll('_',' ')} · {f.reportId}</small></div>{linked(f)?<span className={styles.linkedBadge}>Linked to selected deduction</span>:<button className={styles.secondary} disabled={!deduction||busy||!!prepared} onClick={()=>prepare(f)}>Link to this deduction</button>}</li>)}</ul>
  </>}
  {prepared&&<section className={styles.preview} aria-label="Evidence link preview"><h3>Review this evidence reference</h3><p>{prepared.preview.payload.text}</p><p>Link to: <strong>{records.settlement?.deductions.find(d=>d.id===prepared.preview.payload.deductionId)?.reason}</strong></p><p>Both tenancy parties can see this reference. Linking a file does not verify its contents.</p><div className={styles.questions}><button disabled={busy} onClick={confirm}>Confirm evidence link</button><button disabled={busy} className={styles.secondary} onClick={()=>setPrepared(null)}>Cancel</button></div></section>}
 </section>;
}
