import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {PrismaClient} from '@prisma/client';
import {loadDevelopmentDatabaseUrl} from './supabase-config.mjs';
const db=new PrismaClient({datasources:{db:{url:loadDevelopmentDatabaseUrl()}},log:[]});
let stage='setup';const rollback=new Error('EXPECTED_ROLLBACK');
try {
 await db.$transaction(async tx=>{
  const tenancy='fixture-b-tenancy',tenant='fixture-b-tenant',landlord='fixture-b-landlord';
  const refund=await tx.depositRefund.findUniqueOrThrow({where:{tenancyId:tenancy}});
  assert.notEqual(refund.status,'PAID');
  const names=[0,1,2].map(i=>'fixture-b-resolution-'+randomUUID()+'-'+i);
  for(const [i,id] of names.entries())await tx.depositDeduction.create({data:{id,refundId:refund.id,reason:'Synthetic transactional scenario '+i,amount:[10,20,30][i],status:'PROPOSED',photoIds:'[]'}});
  const rows=await tx.depositDeduction.findMany({where:{refundId:refund.id,status:{not:'WITHDRAWN'}}});
  const total=rows.reduce((s,d)=>s+Number(d.amount),0);
  await tx.depositRefund.update({where:{id:refund.id},data:{status:'IN_REVIEW',refundAmount:Number(refund.originalAmount)-total}});
  await tx.$executeRawUnsafe('INSERT INTO public."RecordsRevision"("tenancyId") VALUES($1) ON CONFLICT DO NOTHING',tenancy);
  let [{revision}]=await tx.$queryRawUnsafe('SELECT revision FROM public."RecordsRevision" WHERE "tenancyId"=$1',tenancy);
  const submit=async(actor,kind,payload,id=randomUUID(),rev=revision)=>{
   const [{result}]=await tx.$queryRawUnsafe('SELECT public.records_submit($1,$2,$3,$4::integer,$5,$6::jsonb) AS result',actor,tenancy,id,rev,kind,JSON.stringify(payload));
   if(!result.replayed)revision=result.revision;return result;
  };
  const deny=async(operation)=>{
   await tx.$executeRawUnsafe('SAVEPOINT invalid_action');
   let failed=false;try{await operation();}catch{failed=true;}
   await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT invalid_action');
   assert.ok(failed,'Expected a rejected action');
  };
  const state=()=>tx.depositRefund.findUniqueOrThrow({where:{id:refund.id},include:{deductions:true}});
  stage='multi-item disputes';
  const d1=await submit(tenant,'DISPUTE',{deductionId:names[0],text:'Synthetic dispute with written evidence.'});
  await submit(tenant,'DISPUTE',{deductionId:names[1],text:'Synthetic second disputed item.'});
  stage='wrong-role and fractional money rejected by SQL';
  await deny(()=>submit(tenant,'WITHDRAWAL',{deductionId:names[0],text:'Cannot withdraw as tenant.'}));
  await deny(()=>submit(landlord,'ADJUSTMENT',{deductionId:names[1],text:'Fractional minor units rejected.',amountSen:1.5}));
  await deny(()=>submit(landlord,'ADJUSTMENT',{deductionId:names[1],text:'Overflow proposal rejected.',amountSen:9999999999}));
  stage='latest reply and rejection';
  const old=await submit(landlord,'RESPONSE',{disputeId:d1.id,text:'Initial test response for the dispute.'});
  const reply=await submit(landlord,'RESPONSE',{disputeId:d1.id,text:'Latest test response for the dispute.'});
  await deny(()=>submit(tenant,'ACCEPTANCE',{responseId:old.id,text:'I accept this landlord response.'}));
  await submit(tenant,'REJECTION',{responseId:reply.id,text:'I disagree; the evidence predates this charge.'});
  await deny(()=>submit(tenant,'ACCEPTANCE',{responseId:reply.id,text:'I accept this landlord response.'}));
  await deny(()=>submit(tenant,'REJECTION',{responseId:reply.id,text:'Cannot reject this reply twice.'}));
  stage='withdrawal, idempotency and another dispute stays open';
  const before=await state();
  const payload={deductionId:names[0],text:'Withdraw after reviewing test evidence.'};
  const withdrawn=await submit(landlord,'WITHDRAWAL',payload);
  assert.equal((await submit(landlord,'WITHDRAWAL',payload,withdrawn.id,0)).replayed,true);
  const after=await state();assert.equal(after.status,'DISPUTED');
  assert.equal(Number(after.refundAmount),Number(before.refundAmount)+10);
  await deny(()=>submit(landlord,'RESPONSE',{disputeId:d1.id,text:'Closed disputes reject new replies.'}));
  stage='proposal reject, supersede and acceptance';
  const proposal=await submit(landlord,'ADJUSTMENT',{deductionId:names[1],text:'First revised test amount.',amountSen:1500});
  assert.equal(Number((await state()).refundAmount),Number(after.refundAmount));
  await submit(tenant,'ADJUSTMENT_REJECTION',{adjustmentId:proposal.id,text:'The proposed amount is still disputed.'});
  await deny(()=>submit(tenant,'ADJUSTMENT_ACCEPTANCE',{adjustmentId:proposal.id,text:'I accept this proposed deduction amount.'}));
  const older=await submit(landlord,'ADJUSTMENT',{deductionId:names[1],text:'Another revised test amount.',amountSen:1200});
  const current=await submit(landlord,'ADJUSTMENT',{deductionId:names[1],text:'Latest revised test amount.',amountSen:1000});
  await deny(()=>submit(tenant,'ADJUSTMENT_ACCEPTANCE',{adjustmentId:older.id,text:'I accept this proposed deduction amount.'}));
  const accepted=await submit(tenant,'ADJUSTMENT_ACCEPTANCE',{adjustmentId:current.id,text:'I accept this proposed deduction amount.'});
  const adjusted=await state();assert.equal(Number(adjusted.refundAmount),Number(after.refundAmount)+10);
  assert.equal(adjusted.deductions.find(d=>d.id===names[1]).status,'ACCEPTED');
  assert.equal(adjusted.status,adjusted.deductions.some(d=>d.status==='DISPUTED')?'DISPUTED':'IN_REVIEW');
  const [audit]=await tx.$queryRawUnsafe('SELECT effects FROM public."RecordsActionEvent" WHERE id=$1',accepted.id);
  assert.equal(audit.effects.beforeAmountSen,2000);assert.equal(audit.effects.afterAmountSen,1000);
  stage='remaining proposals and final agreement';
  for(const d of (await state()).deductions.filter(d=>d.status==='PROPOSED'))await submit(tenant,'DEDUCTION_ACCEPTANCE',{deductionId:d.id,text:'I accept this recorded deduction.'});
  for(const d of (await state()).deductions.filter(d=>d.status==='DISPUTED'))await submit(landlord,'WITHDRAWAL',{deductionId:d.id,text:'Synthetic final withdrawal in rollback-only test.'});
  assert.equal((await state()).status,'AGREED');
  await deny(()=>submit(landlord,'ADJUSTMENT',{deductionId:names[1],text:'Cannot alter a closed deduction.',amountSen:500}));
  throw rollback;
 },{timeout:120000,maxWait:15000});
} catch(e) {
 if(e===rollback)console.log('PASS: real SQL multi-item resolution, role boundaries, reply rejection, proposal rejection/supersession, accepted amount calculation, audit effects, idempotency, and final agreement. All scenario changes rolled back; existing history retained.');
 else {console.error('FAIL at '+stage+'. Credentials and raw SQL errors suppressed.');process.exitCode=1;}
} finally {await db.$disconnect();}
