'use client';
import { useEffect, useRef, useState } from 'react';
import type { ActionInput, prepareActionToken } from '@/lib/companion/records-actions';
import { money, revisedRefund, eventDeduction, type Records } from '@/lib/companion/records-workflow';
import { labels, optionsFor, routeDialogue } from '@/lib/companion/records-dialogue';
import EvidenceReferences from './EvidenceReferences';
import { askMcpRecords, previewThroughMcp } from '@/lib/companion/mcp-client';
import styles from './records.module.css';
type Props={records:Records;viewerId:string;selected:string;draftReset:number;onSelect:(id:string)=>void;busy:boolean;setBusy:(value:boolean)=>void;reload:()=>Promise<void>};
type Line={role:'assistant'|'you';text:string;sourceIds?:string[]};
const welcome:Line={role:'assistant',text:'Choose a deduction, then tell me what you want to review or do. You can say “show evidence for the second deduction” or “I disagree”. Every action has a separate review and confirmation.'};
const restoredNotice='Conversation restored from this browser session. Current records have been reloaded; earlier answers may be out of date.';
export default function RecordSubmissions({records,viewerId,selected,draftReset,onSelect,busy,setBusy,reload}:Props) {
 const [kind,setKind]=useState<ActionInput['kind']>('REPORT');
 const [text,setText]=useState(''); const [amount,setAmount]=useState('');
 const [reportType,setReportType]=useState<'MOVE_IN'|'MOVE_OUT'|'INSPECTION'>('MOVE_OUT');
 const [prepared,setPrepared]=useState<ReturnType<typeof prepareActionToken>|null>(null);
 const [error,setError]=useState(''); const [receipt,setReceipt]=useState('');
 const [chatInput,setChatInput]=useState(''); const [chat,setChat]=useState<Line[]>([welcome]);
 const [restored,setRestored]=useState(false);
 const [toolStatus,setToolStatus]=useState('');
 const transcript=useRef<HTMLDivElement>(null);
 const storageKey='records-chat:'+viewerId+':'+records.tenancyId;
 useEffect(()=>{setPrepared(null);setReceipt('');},[selected]);
 // Manual card selection starts a fresh draft. Chat-directed selection fills its
 // own new draft instead, so selecting “second deduction” cannot erase that input.
 useEffect(()=>{setKind('REPORT');setText('');setAmount('');setPrepared(null);setError('');},[draftReset]);
 useEffect(()=>{if(transcript.current)transcript.current.scrollTop=transcript.current.scrollHeight;},[chat]);
 useEffect(()=>{
  try {
   const saved=JSON.parse(sessionStorage.getItem(storageKey)??'null');
   if(Array.isArray(saved)) {
    const lines:Line[]=saved.filter((l:Line)=>l&&['assistant','you'].includes(l.role)&&typeof l.text==='string'&&l.text.length<=12000&&l.text!==restoredNotice).slice(-24).map((l:Line)=>({role:l.role,text:l.text,sourceIds:Array.isArray(l.sourceIds)?l.sourceIds.filter(id=>typeof id==='string'):[]}));
    if(lines.length) setChat([...lines,{role:'assistant',text:restoredNotice}]);
   }
  } catch { /* Storage is optional; current records stay authoritative. */ }
  setRestored(true);
 },[storageKey]);
 useEffect(()=>{if(restored)try{sessionStorage.setItem(storageKey,JSON.stringify(chat.slice(-24)));}catch{}},[chat,restored,storageKey]);
 const options=optionsFor(records,selected);
 const active=options.find(o=>o.kind===kind)??options[0];
 const currentKind=active.kind;
 const deduction=records.settlement?.deductions.find(d=>d.id===selected);
 const needsMessage=!['ACCEPTANCE','ADJUSTMENT_ACCEPTANCE','DEDUCTION_ACCEPTANCE'].includes(currentKind);
 function switchKind(next:ActionInput['kind']) {setKind(next);setPrepared(null);setError('');setReceipt('');setText('');setAmount('');setToolStatus('');}
 async function send(body:object) {
  const response=await fetch('/api/records/'+encodeURIComponent(records.tenancyId)+'/actions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),cache:'no-store'});
  const data=await response.json(); if(!response.ok)throw new Error(data.error??'Submission unavailable.');return data;
 }
 async function ask(event:React.FormEvent<HTMLFormElement>) {
  event.preventDefault();const message=chatInput.trim();if(!message||busy||prepared)return;
  const result=routeDialogue(records,selected,message); onSelect(result.deductionId);
  // A new message must never leave an earlier accepting draft actionable.
  switchKind(result.kind??'REPORT');
  setChat(c=>[...c,{role:'you',text:message}]);setChatInput('');
  if(result.kind) {
   setReportType(result.reportType);setAmount(result.amount);
   if(!['ACCEPTANCE','ADJUSTMENT_ACCEPTANCE','DEDUCTION_ACCEPTANCE'].includes(result.kind))setText(message);
  }
  if(!result.question){setChat(c=>[...c,{role:'assistant',text:result.notice}]);return;}
  setBusy(true);
  try {
   setToolStatus('Checking current sources through connected tools…');
   const data=await askMcpRecords(records.tenancyId,message,result.deductionId||undefined);
   if(data.revision!==records.revision){await reload();throw new Error('Records changed. The page has been refreshed; please ask again.');}
   setToolStatus('Current sources checked. No records changed.');
   setChat(c=>[...c,{role:'assistant',text:data.answer.text,sourceIds:data.answer.sourceIds}]);
  }catch(e){setToolStatus('Source check could not be completed.');setChat(c=>[...c,{role:'assistant',text:e instanceof Error?e.message:'Records unavailable.'}]);}
  finally{setBusy(false);}
 }
 async function prepare(event:React.FormEvent<HTMLFormElement>) {
  event.preventDefault();setBusy(true);setError('');setReceipt('');
  let payload:ActionInput['payload']={text};
  if(currentKind==='REPORT')payload={text,reportType};
  else if(['DISPUTE','WITHDRAWAL'].includes(currentKind))payload={text,deductionId:active.target};
  else if(currentKind==='DEDUCTION_ACCEPTANCE')payload={text:'I accept this recorded deduction.',deductionId:active.target};
  else if(currentKind==='ADJUSTMENT'){
   const {parseMoney}=await import('@/lib/companion/records-workflow');payload={text,deductionId:active.target,amountSen:parseMoney(amount)??-1};
  } else if(currentKind==='RESPONSE')payload={text,disputeId:active.target};
  else if(currentKind==='ACCEPTANCE')payload={text:'I accept this landlord response.',responseId:active.target};
  else if(currentKind==='REJECTION')payload={text,responseId:active.target};
  else payload={text:currentKind==='ADJUSTMENT_ACCEPTANCE'?'I accept this proposed deduction amount.':text,adjustmentId:active.target};
  try{
   setPrepared(null);setToolStatus('Checking your draft against current records…');
   const action={kind:currentKind,payload};
   await previewThroughMcp(records.tenancyId,records.revision,action);
   const review=await send({operation:'prepare',action});
   if(review.preview.revision!==records.revision){await reload();throw new Error('Records changed. Review the updated page and try again.');}
   setPrepared(review);setToolStatus('Draft checked. Review below before confirming.');
  }
  catch(e){setToolStatus('Draft check could not be completed.');setError(e instanceof Error?e.message:'Could not prepare.');}
  finally{setBusy(false);}
 }
 async function confirm() {
  if(!prepared)return;setBusy(true);setError('');
  try {
   const data=await send({operation:'confirm',confirmed:true,token:prepared.token});
   const saved=labels[prepared.preview.kind]+'. Saved reference: '+data.receipt.id+(data.receipt.replayed?' (already saved; no duplicate).':'.');
   setReceipt(saved);setChat(c=>[...c,{role:'assistant',text:saved}]);setPrepared(null);setText('');setAmount('');setKind('REPORT');
   try{await reload();}catch{setError('Saved successfully. Refresh access to load the latest state.');}
  }catch(e){setError(e instanceof Error?e.message:'Result uncertain. Retry this same confirmation.');}
  finally{setBusy(false);}
 }
 const previewEvent=records.history.find(e=>e.id===(prepared?.preview.payload.responseId??prepared?.preview.payload.adjustmentId??prepared?.preview.payload.disputeId));
 const previewDeduction=records.settlement?.deductions.find(d=>d.id===(prepared?.preview.payload.deductionId??eventDeduction(records,previewEvent)));
 let newAmount=previewDeduction?.amountSen;
 if(prepared?.preview.kind==='WITHDRAWAL')newAmount=0;
 if(prepared?.preview.kind==='ADJUSTMENT')newAmount=prepared.preview.payload.amountSen;
 if(prepared?.preview.kind==='ADJUSTMENT_ACCEPTANCE')newAmount=previewEvent?.payload.amountSen;
 let newRefund:number|undefined;
 if(previewDeduction&&newAmount!==undefined)try{newRefund=revisedRefund(records,previewDeduction.id,newAmount);}catch{}
 const changing=prepared&&['WITHDRAWAL','ADJUSTMENT_ACCEPTANCE'].includes(prepared.preview.kind);
 return <section className={styles.submissions} id="review-action">
  <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>DISCUSS · REVIEW · CONFIRM</p><h2>Find a way forward.</h2></div><span className={styles.eyebrow}>REVISION {records.revision}</span></div>
  <section className={styles.conversation} aria-label="Action assistant">
   <div className={styles.conversationHead}><span className={styles.assistantMark}>re.</span><div><strong>Your rental conversation</strong><small>{deduction?deduction.reason+' · '+money(deduction.amountSen):'Choose a deduction above to start'}</small></div></div>
   <div ref={transcript} className={styles.transcript} aria-live="polite">{chat.map((line,i)=><div key={i} className={line.role==='you'?styles.userMessage:styles.assistantMessage}><p>{line.text}</p>{line.sourceIds&&<EvidenceReferences records={records} ids={line.sourceIds}/>}</div>)}</div>
   <form className={styles.chatComposer} onSubmit={ask}><label className={styles.srOnly} htmlFor="action-chat">Describe what you want to do</label><input id="action-chat" value={chatInput} onChange={e=>setChatInput(e.target.value)} disabled={busy||!!prepared} maxLength={500} placeholder="Show evidence for the second deduction…"/><button disabled={busy||!!prepared||!chatInput.trim()}>Continue</button></form>
   <small>Conversation stays in this browser session. New messages clear unsaved form drafts. A chat message never confirms an action.</small>
   {toolStatus&&<p role="status" className={styles.help}>{toolStatus}</p>}
  </section>
  {error&&<p role="alert" className={styles.error}>{error}</p>}{receipt&&<p role="status" className={styles.receipt}>{receipt}</p>}
  {prepared?<section className={styles.preview} aria-label="Submission preview">
   <p className={styles.eyebrow}>READY FOR YOUR REVIEW · EXPIRES IN 10 MINUTES</p><h3>{labels[prepared.preview.kind]}</h3>
   {previewDeduction&&<p><strong>{previewDeduction.reason}</strong><br/>{previewDeduction.id}</p>}
   {previewEvent&&<blockquote>{previewEvent.payload.text}{previewEvent.payload.amountSen!==undefined&&<strong> Proposed amount: {money(previewEvent.payload.amountSen)}</strong>}</blockquote>}
   <blockquote>{prepared.preview.payload.text}</blockquote>
   {previewDeduction&&newAmount!==undefined&&<div className={styles.amountReview}><div><small>DEDUCTION {changing?'AFTER CONFIRMATION':prepared.preview.kind==='ADJUSTMENT'?'IF ACCEPTED':'BEING ACCEPTED / REVIEWED'}</small><strong>{money(previewDeduction.amountSen)} → {money(newAmount)}</strong></div><div><small>RECORDED REFUND</small><strong>{money(records.settlement!.recordedRefundSen)} → {newRefund===undefined?'Needs review':money(newRefund)}</strong></div></div>}
   <p>{prepared.preview.kind==='ADJUSTMENT'?'This saves a proposal. Current amounts remain in place until the tenant accepts.':prepared.preview.kind==='WITHDRAWAL'?'The deduction becomes withdrawn; its history is retained. The recorded refund increases accordingly.':prepared.preview.kind==='ADJUSTMENT_ACCEPTANCE'?'The new amount takes effect and this deduction is accepted. Other unresolved deductions stay open.':prepared.preview.kind.includes('REJECTION')?'The decision and your reason are saved. The dispute remains open and amounts stay the same.':prepared.preview.kind==='RESPONSE'?'The tenant can review and accept or reject your reply. This reply alone keeps the dispute open.':prepared.preview.kind==='REPORT'?'This appends a new condition report.':prepared.preview.kind==='DISPUTE'?'This opens a dispute on this deduction; amounts stay the same.':'This accepts the recorded deduction amount and resolves this item.'} No payment is made.</p>
   <div className={styles.questions}><button disabled={busy} onClick={confirm}>Confirm and save</button><button className={styles.secondary} disabled={busy} onClick={()=>setPrepared(null)}>Edit / cancel preview</button></div>
  </section>:<form className={styles.submissionForm} onSubmit={prepare}>
   <label>Action<select disabled={busy} value={currentKind} onChange={e=>switchKind(e.target.value as ActionInput['kind'])}>{options.map(o=><option value={o.kind} key={o.kind}>{labels[o.kind]}</option>)}</select></label>
   {currentKind==='REPORT'?<label>Report type<select value={reportType} disabled={busy} onChange={e=>setReportType(e.target.value as typeof reportType)}><option value="MOVE_OUT">Move-out</option><option value="MOVE_IN">Move-in</option><option value="INSPECTION">Inspection</option></select></label>:<div><small>SELECTED DEDUCTION</small><p>{deduction?.reason}<br/>{deduction&&money(deduction.amountSen)}</p></div>}
   {currentKind==='ADJUSTMENT'&&<label>Proposed amount (MYR)<input inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)} disabled={busy} required placeholder="100.00"/><small>Use withdrawal to remove the entire deduction.</small></label>}
   {needsMessage&&<label className={styles.wide}>Your {currentKind==='REPORT'?'observations':'reason or message'}<textarea required minLength={10} maxLength={2000} rows={4} value={text} onChange={e=>setText(e.target.value)} disabled={busy} placeholder="Explain your position and refer to the relevant evidence."/></label>}
   <div className={styles.wide}><button disabled={busy||(needsMessage&&text.trim().length<10)}>Review action →</button><span className={styles.help}> Saved only after confirmation.</span></div>
  </form>}
  <section className={styles.history} aria-label="Submission history"><h3>A shared record.</h3><p className={styles.help}>Decisions retain their reasons and previous amounts. Other deductions are handled separately.</p>
   {records.history.filter(e=>!selected||eventDeduction(records,e)===selected||e.kind==='REPORT').map(e=><article key={e.id}><div><strong>{e.kind.replaceAll('_',' ')}</strong><span>Revision {e.revision} · {new Date(e.createdAt).toLocaleString('en-GB')}</span></div><p>{e.payload.text}</p>{e.payload.amountSen!==undefined&&<p>Proposed deduction: {money(e.payload.amountSen)}</p>}{e.effects?.beforeRefundSen!==undefined&&e.effects.beforeRefundSen!==e.effects.afterRefundSen&&<p>Refund: {money(e.effects.beforeRefundSen)} → {money(e.effects.afterRefundSen!)}</p>}<small>{e.actorId} · {e.id}</small></article>)}
  </section>
 </section>;
}
