import type { Records } from './records-workflow';

export function evidenceNotices(evidence: Records['evidence']) {
  const notices:string[]=[];
  for(const kind of ['MOVE_IN','MOVE_OUT']) if(!evidence.some(e=>e.kind===kind))
    notices.push('No published '+(kind==='MOVE_IN'?'move-in':'move-out')+' report is available.');
  if(evidence.some(e=>['DISPUTED','COUNTER_EVIDENCE_ADDED','CORRECTION_REQUESTED'].includes(e.status)))
    notices.push('A report is disputed or contested. Its statements are not an agreed baseline; review its status with the other party.');
  if(evidence.some(e=>!e.text?.trim()))
    notices.push('A report has missing written notes. No condition or observation is inferred from that absence.');
  if(evidence.some(e=>e.kind==='MOVE_IN'&&!['ACCEPTED','LOCKED'].includes(e.status)))
    notices.push('The available move-in baseline is not accepted or locked. Do not treat it as a shared finding.');
  notices.push('Reports may contain conflicting accounts; no conflict has been resolved by this answer.');
  return notices;
}
