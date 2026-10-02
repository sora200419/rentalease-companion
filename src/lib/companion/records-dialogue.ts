import type { ActionKind } from './records-actions';
import { availableAdjustments, availableResponses, eventDeduction, openDisputes, parseMoney, type Records } from './records-workflow';

export const labels: Record<ActionKind,string> = {
 REPORT:'Submit a condition report', DISPUTE:'Dispute this deduction', RESPONSE:'Reply to the dispute',
 ACCEPTANCE:'Accept the recorded deduction', REJECTION:'Reject the reply',
 WITHDRAWAL:'Withdraw this deduction', ADJUSTMENT:'Propose a revised amount',
 ADJUSTMENT_ACCEPTANCE:'Accept the revised amount', ADJUSTMENT_REJECTION:'Reject the revised amount',
 DEDUCTION_ACCEPTANCE:'Accept this proposed deduction', EVIDENCE_LINK:'Link evidence to this deduction',
};
export function optionsFor(records: Records, deductionId: string): { kind: ActionKind; target: string }[] {
 const result: {kind: ActionKind;target:string}[] = [{kind:'REPORT',target:''}];
 const d = records.settlement?.deductions.find(d => d.id === deductionId);
 if (!d || !['PROPOSED','IN_REVIEW','DISPUTED'].includes(records.settlement?.status ?? '')) return result;
 if (records.role === 'TENANT' && d.status === 'PROPOSED') result.push({kind:'DISPUTE',target:d.id},{kind:'DEDUCTION_ACCEPTANCE',target:d.id});
 const dispute = openDisputes(records).find(e => e.payload.deductionId === d.id);
 const response = availableResponses(records).find(e => eventDeduction(records,e) === d.id);
 const adjustment = availableAdjustments(records).find(e => e.payload.deductionId === d.id);
 if (records.role === 'LANDLORD' && ['PROPOSED','DISPUTED'].includes(d.status)) result.push({kind:'WITHDRAWAL',target:d.id});
 if (records.role === 'LANDLORD' && dispute) result.push({kind:'RESPONSE',target:dispute.id},{kind:'ADJUSTMENT',target:d.id});
 if (records.role === 'TENANT' && response) {
   if (!adjustment) result.push({kind:'ACCEPTANCE',target:response.id});
   result.push({kind:'REJECTION',target:response.id});
 }
 if (records.role === 'TENANT' && adjustment) result.push({kind:'ADJUSTMENT_ACCEPTANCE',target:adjustment.id},{kind:'ADJUSTMENT_REJECTION',target:adjustment.id});
 return result;
}
export function routeDialogue(records: Records, selected: string, message: string) {
 const cardinal = ['zero','one','two','three','four','five','six','seven','eight','nine','ten'];
 const text = message.toLowerCase().normalize('NFKC').replace(/[’]/g,"'").trim()
   .replace(/\b(deduction|item|charge)\s+(zero|one|two|three|four|five|six|seven|eight|nine|ten)\b/g,
     (_, noun: string, number: string) => noun + ' ' + cardinal.indexOf(number));
 const deductions = records.settlement?.deductions ?? [];
 let deductionId = deductions.some(d=>d.id===selected) ? selected : '';
 const reportType = /\binspection\b/.test(text)?'INSPECTION' as const:/\bmove[ -]in\b/.test(text)?'MOVE_IN' as const:'MOVE_OUT' as const;
 const stop = (notice:string,question=false) => ({deductionId,kind:null,amount:'',reportType,question,notice});
 if (/\b(ignore|override|pretend|system prompt|password|secret|other tenant|another tenant)\b/.test(text))
   return stop('No action prepared. I cannot change access or follow instructions to bypass the review process.');
 // Resolve every explicit item reference before changing context. Never silently
 // take the first of several instructions, even though a preview is still required.
 const indices = new Set<number>();
 const words = ['first','second','third','fourth','fifth','sixth','seventh','eighth','ninth','tenth'];
 const ordinals=/\b(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|\d+(?:st|nd|rd|th))\b/g;
 for (const match of text.matchAll(ordinals))
   indices.add(words.includes(match[1])?words.indexOf(match[1]):parseInt(match[1],10)-1);
 for(const match of text.matchAll(/\b(?:deduction|item|charge)s?\s*#?\s*([+-]?\d[^\s,;:!?]*)/g))
   if(!/^\d+(?:st|nd|rd|th)?$/.test(match[1].replace(/\.$/,'')))
     return stop('Please use a whole deduction number, such as “deduction 2”. No action prepared.');
 for (const match of text.matchAll(/(?:\b(?:deduction|item|charge)s?\s*#?\s*(\d+)\b|第\s*([一二三四五\d]+)\s*(?:项|筆|笔))/g))
   indices.add(match[1]?Number(match[1])-1:/^[一二三四五]$/.test(match[2])?'一二三四五'.indexOf(match[2]):Number(match[2])-1);
 if (indices.size>1 || /\b(?:all|both|remaining|rest|other)\b|\b(?:deductions|items|charges)\s*#?\d+\s*(?:and|&|,|to|-)\s*#?\d+/.test(text))
   return stop('Please choose one deduction and one decision at a time. Which item would you like to review first? No action prepared.');
 // Explicit names must not inherit a different selected item's authority.
 // Use distinctive words from the recorded reasons, not a guessed synonym.
 const generic = new Set(['the','a','an','for','of','and','deduction','charge','cost','fee','replacement']);
 const named = deductions.flatMap((d, index) => {
   const tokens = d.reason.toLowerCase().match(/[a-z]+/g) ?? [];
   return tokens.some(token => token.length > 2 && !generic.has(token) && new RegExp('\\b' + token + '\\b').test(text)) ? [index] : [];
 });
 for (const name of named) indices.add(name);
 if (indices.size > 1) return stop('The message names different deductions. Please choose one deduction and one decision. Nothing has been prepared.');
 const index=[...indices][0];
 if (index!==undefined) {
   if (!deductions[index]) {deductionId='';return stop('That deduction number is not in this tenancy. Select an existing deduction.');}
   deductionId=deductions[index].id;
 } else if (!deductionId && deductions.length===1) deductionId=deductions[0].id;
 const actionWords=/\b(accept|accepting|agree|reject|decline|refuse|disagree|withdraw|remove|cancel|adjust|reduce|lower|revise|propose|dispute|contest|challenge|submit|reply|respond)\b/.test(text);
 if (actionWords && /\b(last|final|next|previous|earlier|latest|newest)\b/.test(text))
   return stop('Please identify the deduction by its number or name and specify the current reply or revised amount. Relative or earlier references need clarification; no action prepared.');
 if (actionWords && (/\b(?:what|why|how|should)\b/.test(text) || /^(?:can|could|would|do|does|did|is|are|will)\b/.test(text) || text.endsWith('?')))
   return stop('That sounds like a question, not a decision. No action prepared; review the explanation before choosing an action.',true);
 if (actionWords && /\b(?:if|unless|until|maybe|perhaps|might|possibly|unsure|not sure|or|said|says|told|asked|wrote|quote|quoted|nothing|neither)\b/.test(text))
   return stop('I need a clear, unconditional decision from you, not a possibility or a quoted instruction. Please clarify one action. Nothing has been prepared.');
 if (/\bcancel\b/.test(text) && !/\bcancel (?:the |this )?(?:deduction|charge)\b/.test(text))
   return stop('No action prepared. Cancel a submission using “Edit / cancel preview”; cancelling a draft does not withdraw a deduction.');
 const options=optionsFor(records,deductionId);
 const has=(kind:ActionKind)=>options.some(o=>o.kind===kind);
 const negatedRefusal=/\b(?:don't|do not|not|never|cannot|can't|won't)\s+(?:want to\s+)?(?:disagree|reject|decline|refuse|dispute)\b/.test(text);
 if (negatedRefusal) return stop('No action prepared. You can keep reviewing the evidence.');
 const negativeAcceptance=/(?:do not|don't|cannot|can't|won't|not)\s+(?:want to\s+)?(?:accept(?:ing)?|agree(?:ing)?)\b/g;
 const refusal=/\b(disagree|reject|decline|refuse)\b|不同意|不接受/.test(text)||new RegExp(negativeAcceptance).test(text);
 const affirmative=text.replace(negativeAcceptance,' ');
 const acceptance=/\b(accept|agree)\b/.test(affirmative);
 const withdrawal=/\b(withdraw|remove)\b|\bcancel (?:the |this )?(?:deduction|charge)\b/.test(text);
 const adjustment=/\b(adjust|reduce|lower|revise|propose)\b/.test(text);
 const dispute=/\b(dispute|contest|challenge)\b/.test(text);
 const responseIntent=/\b(reply|respond)\b/.test(text) && !/\b(?:the|this|that|landlord'?s?)\s+reply\b/.test(text);
 const reportIntent=/\b(submit|add|create|write)\b.*\b(report|inspection)\b/.test(text);
 if ([refusal,acceptance,withdrawal,adjustment,dispute&&!refusal,responseIntent,reportIntent].filter(Boolean).length>1)
   return stop('Please clarify one action for this deduction. The message contains different decisions; nothing has been prepared.');
 const negated=/\b(?:don't|do not|not|never|cannot|can't|won't|no longer)\b|不要/.test(text);
 const explicitReply=/\b(reply|response)\b/.test(text);
 const explicitProposal=/\b(revised|new|proposal|offer)\b/.test(text);
 if (explicitReply&&explicitProposal&&(acceptance||refusal))
   return stop('Do you mean the landlord’s reply or the revised amount? Please choose one; no action prepared.');
 if (/\b(?:original|old|previous|different)\s+(?:amount|proposal|offer|price)\b/.test(text)&&(acceptance||refusal))
   return stop('Please review the currently available amount and response. I cannot infer a decision on an old or different offer.');
 let kind:ActionKind|null=null;
 if (refusal&&records.role==='TENANT') kind=explicitReply?'REJECTION':explicitProposal?'ADJUSTMENT_REJECTION':has('ADJUSTMENT_REJECTION')?'ADJUSTMENT_REJECTION':has('REJECTION')?'REJECTION':has('DISPUTE')?'DISPUTE':null;
 else if (!negated) {
   if (withdrawal) kind='WITHDRAWAL';
   else if (adjustment) kind='ADJUSTMENT';
   else if (acceptance) kind=explicitReply?'ACCEPTANCE':explicitProposal?'ADJUSTMENT_ACCEPTANCE':has('ADJUSTMENT_ACCEPTANCE')?'ADJUSTMENT_ACCEPTANCE':has('ACCEPTANCE')?'ACCEPTANCE':'DEDUCTION_ACCEPTANCE';
   else if (dispute) kind='DISPUTE';
   else if (/\b(reply|respond)\b/.test(text)) kind='RESPONSE';
   else if (/\b(submit|add|create|write)\b.*\b(report|inspection)\b/.test(text)) kind='REPORT';
 }
 // Recognizing a verb inside narration is not sufficient intent. Unsupported
 // phrasing can still be handled through the explicit action menu.
 const direct=/^(?:please\s+)?(?:(?:i\s+(?:(?:want|would like|choose|intend|need)\s+to\s+)?(?:am\s+)?(?:do not\s+|don't\s+|not\s+|cannot\s+|can't\s+|won't\s+)?(?:want to\s+)?)|(?:do not\s+|don't\s+))?(?:accept(?:ing)?|agree(?:ing)?|disagree|reject|decline|refuse|withdraw|remove|cancel|adjust|reduce|lower|revise|propose|dispute|contest|challenge|reply|respond|submit|add|create|write)\b|^(?:我)?(?:不同意|不接受)/.test(text);
 if (kind&&!direct) return stop('Please state your own decision directly, such as “I reject the revised amount”, or use the action menu. No action prepared.');
 if(kind&&(acceptance||refusal)&&/\b(refund|payment|transfer|bank|agreement|contract|lease)\b/.test(text))
   return stop('This workflow only reviews deduction decisions. It cannot accept payments, sign agreements or transfer a refund. No action prepared.');
 // Keep complete amount tokens; reject multiple prices and unsupported currencies.
 const amounts=[...text.matchAll(/(?:\b(?:myr|rm)\s*|\b(?:amount|to)\s+(?=[\d+-]))(\S+)/g)].map(m=>m[1].replace(/[.!?]$/,''));
 const withoutReferences=text.replace(ordinals,'').replace(/\b(?:deduction|item|charge)s?\s*#?\s*\d+/g,'')
   .replace(/(?:\b(?:myr|rm)\s*|\b(?:amount|to)\s+(?=[\d+-]))\S+/g,'');
 if(kind&&(acceptance||refusal||adjustment)&&/\b\d/.test(withoutReferences))
   return stop('An extra or unlabelled number makes this amount unclear. Please use one exact MYR amount and one deduction number.');
 if (kind && (/\b(?:usd|sgd|eur|dollars)\b|[$€£¥]/.test(text) || amounts.length>1 || amounts.some(a=>parseMoney(a)===null)))
   return stop('Please specify one exact MYR amount, such as MYR 20.00, without ranges or alternative prices. No action prepared.');
 if (kind && kind!=='ADJUSTMENT' && amounts.length) {
   const proposal=availableAdjustments(records).find(e=>e.payload.deductionId===deductionId);
   const expected=kind.startsWith('ADJUSTMENT_')?proposal?.payload.amountSen:deductions.find(d=>d.id===deductionId)?.amountSen;
   if (parseMoney(amounts[0])!==expected) return stop('The amount you mentioned does not match this current decision. Review the recorded amount or revised proposal; no action prepared.');
 }
 if (kind === 'ADJUSTMENT' && !amounts.length)
   return stop('What exact new amount do you propose? Specify one deduction and one MYR amount, such as “Propose MYR 20.00 for item 2”. No action prepared.');
 if (kind && /\bringgit\b/.test(text) && !amounts.length)
   return stop('Please write one exact amount using MYR and digits before choosing this decision.');
 const unavailable=!!kind&&!has(kind);
 if (unavailable) kind=null;
 const question=/^(?:please\s+)?(?:why|what|who|how|show|find|compare|check|which|where|was|were|is|are|can|could)\b|evidence|photo|source|证据|照片/.test(text)&&!actionWords;
 return {deductionId,kind,reportType,amount:kind==='ADJUSTMENT'?amounts[0]??'':'',question:question&&!kind,
   notice:kind?'Review the selected deduction and complete the draft below. Nothing has been saved.'
     :unavailable?'That action is unavailable for your role or the current deduction. Choose one of the available actions below.'
     :negated?'No action prepared. You can keep reviewing the evidence.'
     :deductionId?'No action prepared. Ask about this deduction’s evidence or choose an available action below.':'Select a deduction first, or refer to its number, such as “the second deduction”.',
 };
}
