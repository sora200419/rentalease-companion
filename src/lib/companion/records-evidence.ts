import type { Records } from './records-workflow';
import { money } from './records-workflow';
import { evidenceNotices } from './records-evidence-notices';
import { answerRecordQuestion } from './records-questions';
export function fileHref(tenancyId: string, reportId: string, fileKey: string, preview=false) {
 return '/api/records/'+encodeURIComponent(tenancyId)+'/evidence?reportId='+encodeURIComponent(reportId)+'&file='+encodeURIComponent(fileKey)+(preview?'&preview=1':'');
}
export function evidenceReferences(records: Records) {
 return [
  ...records.evidence.map(e=>({id:e.id,label:e.kind.replace(/_/g,' ')+' report',href:'#'+e.id})),
  ...(records.agreement?[{id:records.agreement.id,label:'Agreement',href:'#'+records.agreement.id}]:[]),
  ...records.history.filter(e=>e.kind==='EVIDENCE_LINK').map(e=>({id:'file:'+e.id,label:e.payload.fileKey!.split('--').slice(2).join('--'),href:fileHref(records.tenancyId,e.payload.reportId!,e.payload.fileKey!)})),
 ];
}
export function deductionAnswer(records: Records, deductionId: string) {
 const d=records.settlement?.deductions.find(d=>d.id===deductionId);
 if(!d) throw new Error('Tenancy unavailable.');
 const links=records.history.filter(e=>e.kind==='EVIDENCE_LINK'&&e.payload.deductionId===d.id);
 const linkedReports=new Set(links.map(e=>e.payload.reportId));
 const reports=records.evidence.filter(e=>linkedReports.has(e.id)||['MOVE_IN','MOVE_OUT'].includes(e.kind)||['DISPUTED','COUNTER_EVIDENCE_ADDED','CORRECTION_REQUESTED'].includes(e.status));
 const lines=[d.reason+': '+money(d.amountSen)+'; status '+d.status+'.'];
 for(const r of reports) lines.push(r.id+' ['+r.kind+'; '+r.status+']: '+(r.text??'No written notes recorded.'));
 for(const e of links) {
   lines.push('Linked file: '+(e.payload.fileKey ?? '').split('--').slice(2).join('--')+' (report '+e.payload.reportId+'). '+e.payload.text);
   if(!records.evidence.some(r=>r.id===e.payload.reportId)) lines.push('Review needed: this file references an unavailable report. Its context cannot be verified.');
 }
 if(!links.length) lines.push('No files are linked to this deduction yet.');
 lines.push(...evidenceNotices(reports));
 lines.push('These are recorded statements and file references. File contents have not been analysed and do not establish liability.');
 return {provider:'records' as const, selection:'rules' as const,topic:'evidence' as const,text:lines.join('\n\n'),sourceIds:[d.id,...reports.map(r=>r.id),...links.map(e=>'file:'+e.id)]};
}

export function answerDeductionQuestion(records:Records,deductionId:string,question:string) {
 if(!records.settlement?.deductions.some(d=>d.id===deductionId)) throw new Error('Tenancy unavailable.');
 const basic=answerRecordQuestion(records,question);
 // “Evidence for the second deduction” asks for sources, not every amount.
 // Keep explicit financial questions and all decision/access guards authoritative.
 if(basic.topic==='amounts' && /\b(evidence|photos?|reports?|sources?|compare|notes)\b/i.test(question) &&
   !/\b(refund|deposit|paid|payment|amount|total|balance|how much)\b/i.test(question))
   return deductionAnswer(records,deductionId);
 // Selecting an item must not bypass the read-only, liability or secret guards.
 if(!['evidence','unsupported'].includes(basic.topic) || /\b(ignore|override|pretend|password|secret|other tenant|another tenant)\b/i.test(question))
   return {...basic,selection:'rules' as const};
 if(basic.topic === 'unsupported' && !/\b(sources?|citations?|files?)\b/i.test(question)) return {...basic,selection:'rules' as const};
 return deductionAnswer(records,deductionId);
}
