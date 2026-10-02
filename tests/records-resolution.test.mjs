import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const get=path=>import(pathToFileURL(join(process.env.RENTALEASE_TEST_OUTPUT,'companion',path+'.js')));
const {parseAction,validateAction}=await get('records-actions');
const {routeDialogue,optionsFor}=await get('records-dialogue');
const {revisedRefund,availableAdjustments,availableResponses,eventDeduction}=await get('records-workflow');
const {deductionAnswer}=await get('records-evidence');
const base={
 tenancyId:'fixture-b-tenancy',role:'TENANT',revision:4,evidence:[{id:'b-in',kind:'MOVE_IN',status:'ACCEPTED',text:'A mark was recorded.'},{id:'b-out',kind:'MOVE_OUT',status:'SUBMITTED',text:'A mark was recorded at move-out.'}],agreement:null,
 settlement:{status:'DISPUTED',recordedOriginalSen:100000,recordedRefundSen:70000,deductions:[{id:'first',reason:'Wall',status:'PROPOSED',amountSen:20000},{id:'second',reason:'Cleaning',status:'DISPUTED',amountSen:10000}]},
 history:[{id:'d2',kind:'DISPUTE',payload:{deductionId:'second',text:'Disputed cleaning.'},revision:1},{id:'r2',kind:'RESPONSE',payload:{disputeId:'d2',text:'Please review cleaning.'},revision:2}],
};
const proposal={id:'a2',kind:'ADJUSTMENT',payload:{deductionId:'second',text:'Propose a reduced cleaning amount.',amountSen:5000},revision:3};
const proposed={...base,history:[...base.history,proposal]};
test('money changes account for all active deductions and reject inconsistent records',()=>{
 assert.equal(revisedRefund(base,'second',5000),75000);
 assert.equal(revisedRefund(base,'first',0),90000);
 assert.throws(()=>revisedRefund(base,'second',90000));
 assert.throws(()=>revisedRefund({...base,settlement:{...base.settlement,recordedRefundSen:123}},'second',5000));
});
test('roles cannot cross proposal, withdrawal, acceptance and rejection boundaries',()=>{
 const adjustment={kind:'ADJUSTMENT',payload:{deductionId:'second',text:'New proposal for testing.',amountSen:5000}};
 assert.throws(()=>validateAction(base,adjustment));
 validateAction({...base,role:'LANDLORD'},adjustment);
 assert.throws(()=>validateAction({...base,role:'LANDLORD'},{...adjustment,payload:{...adjustment.payload,amountSen:10000}}));
 const acceptance={kind:'ADJUSTMENT_ACCEPTANCE',payload:{adjustmentId:'a2',text:'I accept this proposed deduction amount.'}};
 validateAction(proposed,acceptance); assert.throws(()=>validateAction({...proposed,role:'LANDLORD'},acceptance));
 const reject={kind:'REJECTION',payload:{responseId:'r2',text:'I disagree with this response.'}};
 validateAction(base,reject);assert.throws(()=>validateAction({...base,role:'LANDLORD'},reject));
 const withdraw={kind:'WITHDRAWAL',payload:{deductionId:'first',text:'Withdraw this proposed deduction.'}};
 validateAction({...base,role:'LANDLORD'},withdraw);assert.throws(()=>validateAction(base,withdraw));
});
test('rejected and superseded proposals cannot be accepted; open proposals block ambiguous original acceptance',()=>{
 assert.throws(()=>validateAction(proposed,{kind:'ACCEPTANCE',payload:{responseId:'r2',text:'I accept this landlord response.'}}));
 const rejected={...proposed,history:[...proposed.history,{id:'rej',kind:'ADJUSTMENT_REJECTION',payload:{adjustmentId:'a2',text:'I do not agree with this amount.'},revision:4}]};
 assert.equal(availableAdjustments(rejected).length,0);
 const newer={...proposed,history:[...proposed.history,{...proposal,id:'new',revision:5}]};
 assert.throws(()=>validateAction(newer,{kind:'ADJUSTMENT_ACCEPTANCE',payload:{adjustmentId:'a2',text:'I accept this proposed deduction amount.'}}));
});
test('parser rejects fractional minor units, strings, overflows, omitted fields and extra write fields',()=>{
 const good={kind:'ADJUSTMENT',payload:{deductionId:'second',text:'New proposal for testing.',amountSen:5000}};
 assert.deepEqual(parseAction(good),good);
 for(const amountSen of [0,-1,1.1,'100',null,10000000000])assert.throws(()=>parseAction({...good,payload:{...good.payload,amountSen}}));
 assert.throws(()=>parseAction({...good,payload:{text:good.payload.text,amountSen:5000}}));
 assert.throws(()=>parseAction({...good,payload:{...good.payload,refundSen:123}}));
 assert.throws(()=>parseAction({kind:'__proto__',payload:{text:'Some message here.'}}));
});
test('second deduction selects the correct context; I disagree continues the active item',()=>{
 const selected=routeDialogue(base,'first','Show evidence for the second deduction');
 assert.equal(selected.deductionId,'second');assert.equal(selected.question,true);
 const refusal=routeDialogue(base,selected.deductionId,'I disagree');
 assert.equal(refusal.kind,'REJECTION');
 assert.equal(routeDialogue(proposed,'second','我不同意').kind,'ADJUSTMENT_REJECTION');
 assert.equal(routeDialogue(base,'first','第二项扣款').deductionId,'second');
 assert.equal(routeDialogue(base,'first','Dispute deduction 9').kind,null);
 assert.equal(routeDialogue(base,'first','Dispute deduction 9').deductionId,'');
});
test('negation does not create an accepting, withdrawing or adjusting action',()=>{
 for(const text of ["I don't accept the reply",'Do not agree','Never accept','I cannot accept'])assert.notEqual(routeDialogue(base,'second',text).kind,'ACCEPTANCE');
 assert.equal(routeDialogue({...base,role:'LANDLORD'},'second','Do not withdraw').kind,null);
 assert.equal(routeDialogue({...base,role:'LANDLORD'},'second','Propose MYR 50.25').amount,'50.25');
 assert.ok(optionsFor(base,'first').some(o=>o.kind==='DISPUTE'));
 assert.ok(!optionsFor(base,'first').some(o=>o.kind==='WITHDRAWAL'));
});
test('evidence answers preserve baseline context and include only the selected deductions file links',()=>{
 const fileKey='fixture-b-tenant--'+'a'.repeat(64)+'--test.png';
 const records={...base,history:[...base.history,{id:'link',kind:'EVIDENCE_LINK',payload:{deductionId:'second',reportId:'b-in',fileKey,text:'Relevant test photo.'}},{id:'other-link',kind:'EVIDENCE_LINK',payload:{deductionId:'first',reportId:'b-out',fileKey,text:'Other file reference.'}}]};
 const answer=deductionAnswer(records,'second');
 assert.ok(answer.sourceIds.includes('file:link'));
 assert.ok(!answer.sourceIds.includes('file:other-link'));
 assert.ok(answer.sourceIds.includes('b-in')&&answer.sourceIds.includes('b-out'));
 assert.match(answer.text,/have not been analysed/);
 assert.throws(()=>deductionAnswer(records,'foreign'));
});

test('three deductions keep their ordinal identity after independent decisions',()=>{
 const three={...base,settlement:{...base.settlement,recordedRefundSen:67500,deductions:[...base.settlement.deductions,{id:'third',reason:'Key',status:'PROPOSED',amountSen:2500}]}};
 const partial={...three,settlement:{...three.settlement,recordedRefundSen:87500,deductions:three.settlement.deductions.map(d=>d.id==='first'?{...d,status:'WITHDRAWN'}:d)}};
 for(const records of [three,partial]) {
  assert.equal(routeDialogue(records,'third','Show the second deduction').deductionId,'second');
  assert.equal(routeDialogue(records,'second','Show deduction 3').deductionId,'third');
  assert.equal(routeDialogue(records,'first','第三项扣款').deductionId,'third');
 }
 assert.deepEqual(optionsFor(partial,'first').map(o=>o.kind),['REPORT']);
 assert.ok(optionsFor(partial,'second').some(o=>o.kind==='REJECTION'&&o.target==='r2'));
 assert.ok(optionsFor(partial,'third').some(o=>o.kind==='DISPUTE'&&o.target==='third'));
 assert.equal(revisedRefund(partial,'second',5000),92500);
});

test('available actions target the latest unresolved event of the selected deduction only',()=>{
 const history=[
  ...base.history,{id:'d1',kind:'DISPUTE',payload:{deductionId:'first',text:'Wall disputed.'},revision:3},
  {id:'r1',kind:'RESPONSE',payload:{disputeId:'d1',text:'Wall response.'},revision:4},
  {...proposal,id:'a1',payload:{...proposal.payload,deductionId:'first'},revision:5},
  {...proposal,revision:6},{id:'r2-new',kind:'RESPONSE',payload:{disputeId:'d2',text:'Latest cleaning response.'},revision:7},
  {...proposal,id:'a2-new',payload:{...proposal.payload,amountSen:4000},revision:8},
 ];
 const records={...base,settlement:{...base.settlement,deductions:base.settlement.deductions.map(d=>({...d,status:'DISPUTED'}))},history:history.reverse()};
 assert.deepEqual(new Set(availableResponses(records).map(e=>e.id)),new Set(['r1','r2-new']));
 assert.deepEqual(new Set(availableAdjustments(records).map(e=>e.id)),new Set(['a1','a2-new']));
 assert.equal(optionsFor(records,'second').find(o=>o.kind==='REJECTION').target,'r2-new');
 assert.equal(optionsFor(records,'second').find(o=>o.kind==='ADJUSTMENT_ACCEPTANCE').target,'a2-new');
 assert.equal(optionsFor(records,'first').find(o=>o.kind==='ADJUSTMENT_ACCEPTANCE').target,'a1');
 assert.ok(!optionsFor(records,'second').some(o=>o.kind==='ACCEPTANCE'));
 const rejected={...records,history:[...records.history,{id:'reject-a2',kind:'ADJUSTMENT_REJECTION',payload:{adjustmentId:'a2-new',text:'Need further review.'},revision:9}]};
 assert.ok(!availableAdjustments(rejected).some(e=>e.payload.deductionId==='second'));
 assert.equal(optionsFor(rejected,'second').find(o=>o.kind==='ACCEPTANCE').target,'r2-new');
 assert.equal(optionsFor(rejected,'first').find(o=>o.kind==='ADJUSTMENT_ACCEPTANCE').target,'a1');
});

test('closed or foreign selections cannot inherit another deductions write options',()=>{
 const accepted={...proposed,settlement:{...proposed.settlement,deductions:proposed.settlement.deductions.map(d=>d.id==='second'?{...d,status:'ACCEPTED',amountSen:5000}:d)}};
 assert.deepEqual(optionsFor(accepted,'second').map(o=>o.kind),['REPORT']);
 assert.equal(routeDialogue(accepted,'second','I agree').kind,null);
 assert.equal(routeDialogue(accepted,'second','I disagree').kind,null);
 assert.deepEqual(optionsFor(accepted,'foreign').map(o=>o.kind),['REPORT']);
 assert.equal(routeDialogue(accepted,'foreign','I agree').kind,null);
 assert.equal(routeDialogue(accepted,'first','I disagree').kind,'DISPUTE');
 for(const status of ['AGREED','PAID']) {
  const closed={...base,settlement:{...base.settlement,status}};
  for(const role of ['TENANT','LANDLORD'])for(const id of ['first','second'])
   assert.deepEqual(optionsFor({...closed,role},id).map(o=>o.kind),['REPORT']);
 }
});

test('event source references follow parent decisions and stop at missing or cyclic references',()=>{
 const decision={id:'accepted',kind:'ACCEPTANCE',payload:{responseId:'r2',text:'Accepted.'},revision:3};
 assert.equal(eventDeduction({...base,history:[...base.history,decision]},decision),'second');
 assert.equal(eventDeduction(base,{...decision,payload:{responseId:'foreign',text:'No parent.'}}),undefined);
 const cycle=[{id:'cycle-a',payload:{responseId:'cycle-b'}},{id:'cycle-b',payload:{responseId:'cycle-a'}}];
 assert.equal(eventDeduction({...base,history:cycle},cycle[0]),undefined);
});

test('negated refusal requests never prepare the refusal they explicitly decline',()=>{
 for(const message of ["Don't reject this reply",'Do not refuse this reply',"I don't disagree",'I do not want to reject the revised amount']) {
  assert.equal(routeDialogue(proposed,'second',message).kind,null,message);
 }
 assert.equal(routeDialogue(proposed,'second',"I don't accept this amount").kind,'ADJUSTMENT_REJECTION');
});

test('unsupported currency syntax is not silently shortened to a different amount',()=>{
 const landlord={...base,role:'LANDLORD'};
 for(const token of ['1,000.00','50,25','1e3','100000000.00','50.001']) {
  assert.equal(routeDialogue(landlord,'second','Propose MYR '+token).amount,'',token);
 }
 assert.equal(routeDialogue(landlord,'second','Propose MYR 50.25').amount,'50.25');
});
