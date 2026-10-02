import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { loadDevelopmentDatabaseUrl } from './supabase-config.mjs';

// Additive development setup only. Never reopen, reset, or overwrite a decision.
const db=new PrismaClient({datasources:{db:{url:loadDevelopmentDatabaseUrl()}},log:[]});
const additions=[
 {id:'fixture-b-cleaning',reason:'Synthetic kitchen cleaning proposal',amount:'50.00'},
 {id:'fixture-b-key',reason:'Synthetic replacement key proposal',amount:'25.00'},
];
try {
 await db.$transaction(async tx=>{
  if(process.argv.includes('--apply'))await tx.$executeRaw`INSERT INTO public."RecordsRevision"("tenancyId") VALUES('fixture-b-tenancy') ON CONFLICT DO NOTHING`;
  const [version]=await tx.$queryRaw`SELECT revision FROM public."RecordsRevision" WHERE "tenancyId"='fixture-b-tenancy' FOR UPDATE`;
  const refund=await tx.depositRefund.findUniqueOrThrow({where:{tenancyId:'fixture-b-tenancy'},include:{deductions:true}});
  if(additions.every(a=>refund.deductions.some(d=>d.id===a.id))){console.log('Synthetic multi-item fixture already exists; no records changed.');return;}
  assert.ok(['PROPOSED','IN_REVIEW'].includes(refund.status),'Refuse to alter a disputed or closed baseline.');
  assert.equal(refund.deductions.length,1,'Refuse to alter a partially expanded baseline.');
  const original=refund.deductions[0];
  assert.equal(original.id,'fixture-b-deduction');assert.equal(original.status,'PROPOSED');
  assert.equal(Number(refund.originalAmount)-Number(original.amount),Number(refund.refundAmount));
  const [{count}]=await tx.$queryRaw`SELECT COUNT(*)::integer AS count FROM public."RecordsActionEvent" WHERE "tenancyId"='fixture-b-tenancy' AND kind <> 'REPORT'`;
  assert.equal(count,0,'Refuse to alter an already-used dispute scenario.');
  if(!process.argv.includes('--apply')){console.log('Ready to add two synthetic proposed deductions (MYR 50 and MYR 25) to untouched fixture B; --apply required.');return;}
  for(const item of additions)await tx.depositDeduction.create({data:{...item,refundId:refund.id,status:'PROPOSED',photoIds:'[]'}});
  await tx.depositRefund.update({where:{id:refund.id},data:{refundAmount:refund.refundAmount.sub('75.00')}});
  // A labelled setup report records the additions and advances the same revision
  // under the lock, invalidating any earlier confirmation previews atomically.
  const payload={reportType:'INSPECTION',text:'Synthetic demo setup: added kitchen cleaning (MYR 50.00) and replacement key (MYR 25.00) proposals to demonstrate independent deduction decisions. These are test scenarios, not real charges.'};
  await tx.$queryRaw`SELECT public.records_submit('fixture-b-landlord','fixture-b-tenancy',${randomUUID()},${version.revision}::integer,'REPORT',${JSON.stringify(payload)}::jsonb)`;
  console.log('Added two synthetic proposed deductions and a labelled setup report; revision advanced. Existing history retained; no payment or reset.');
 },{timeout:45000});
}catch{console.error('Fixture setup refused or failed. No partial changes committed; raw database errors suppressed.');process.exitCode=1;}
finally{await db.$disconnect();}
