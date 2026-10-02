import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
const base='http://127.0.0.1:3031';
const accounts=JSON.parse(readFileSync('.local-runtime/records-test-accounts.json','utf8'));
let stage='login'; let db;
function client() {
  const jar=new Map();
  return async (path,body,origin=base) => {
    const form=body instanceof URLSearchParams;
    const response=await fetch(base+path,{ method:body?'POST':'GET',redirect:'manual',headers:{ Cookie:[...jar].map(([k,v])=>`${k}=${v}`).join('; '),...(body?{Origin:origin,'Content-Type':form?'application/x-www-form-urlencoded':'application/json'}:{}) },body:form?body:body?JSON.stringify(body):undefined });
    for(const c of response.headers.getSetCookie()) {const p=c.split(';')[0]; const i=p.indexOf('=');jar.set(p.slice(0,i),p.slice(i+1));}
    return response;
  };
}
async function login(id) {
  const account=accounts.find(a=>a.id===id); const request=client();
  const csrf=await (await request('/api/auth/csrf')).json();
  await request('/api/auth/callback/credentials',new URLSearchParams({csrfToken:csrf.csrfToken,email:account.email,password:account.password,json:'true',callbackUrl:`${base}/records`}));
  assert.equal((await request('/api/records')).status,200); return request;
}
try {
  const tenant=await login('fixture-a-tenant'); const landlord=await login('fixture-a-landlord'); const other=await login('fixture-b-tenant');
  const path='/api/records/fixture-a-tenancy/actions';
  const detail=async()=> (await (await tenant('/api/records/fixture-a-tenancy')).json()).records;
  const prepare=async(request,action)=> { const r=await request(path,{operation:'prepare',action});assert.equal(r.status,200);return r.json(); };
  const confirm=(request,p)=>request(path,{operation:'confirm',confirmed:true,token:p.token});
  const report={kind:'REPORT',payload:{reportType:'INSPECTION',text:`Synthetic persistence regression ${randomUUID()}. No real personal data.`}};
  const before=await detail();
  stage='anonymous, cross-tenant, origin and input validation';
  assert.equal((await client()(path,{operation:'prepare',action:report})).status,401);
  assert.equal((await other(path,{operation:'prepare',action:report})).status,404);
  assert.equal((await tenant(path,{operation:'prepare',action:report},'https://other.example')).status,403);
  assert.equal((await tenant(path,{operation:'prepare',action:{...report,actorId:'fixture-b-tenant'}})).status,400);
  assert.equal((await tenant(path,{operation:'prepare',action:{...report,payload:{...report.payload,amount:0}}})).status,400);
  stage='preview does not write';
  const prepared=await prepare(tenant,report); const stale=await prepare(tenant,{...report,payload:{...report.payload,text:'Synthetic stale preview must not be stored.'}});
  assert.equal((await detail()).revision,before.revision);
  assert.equal((await tenant(path,{operation:'confirm',token:prepared.token})).status,400);
  assert.equal((await confirm(landlord,prepared)).status,409);
  const [body,sig]=prepared.token.split('.');const forged=JSON.parse(Buffer.from(body,'base64url').toString());forged.payload.text='Forged report must not be saved.';
  assert.equal((await confirm(tenant,{token:Buffer.from(JSON.stringify(forged)).toString('base64url')+'.'+sig})).status,409);
  stage='concurrent confirmation and durable history';
  const responses=await Promise.all([confirm(tenant,prepared),confirm(tenant,prepared)]);
  responses.forEach(r=>assert.equal(r.status,200));
  const receipts=await Promise.all(responses.map(r=>r.json()));
  assert.equal(receipts.filter(r=>r.receipt.replayed).length,1);
  assert.equal((await confirm(tenant,stale)).status,409);
  const after=await detail(); assert.equal(after.revision,before.revision+1);
  assert.equal(after.history.filter(e=>e.id===prepared.preview.id).length,1);
  assert.ok(after.evidence.some(e=>e.id==='submitted-'+prepared.preview.id && e.text===report.payload.text && e.status==='SUBMITTED'));
  assert.deepEqual(after.settlement,before.settlement);
  const reread=(await (await landlord('/api/records/fixture-a-tenancy')).json()).records;
  assert.ok(reread.history.some(e=>e.id===prepared.preview.id));
  if (after.settlement.deductions.find(d=>d.id==='fixture-a-deduction').status==='ACCEPTED') {
    stage='retained closure and rejected attempts to reopen';
    assert.equal(after.settlement.status,'AGREED');
    const acceptance=after.history.find(e=>e.kind==='ACCEPTANCE');
    assert.ok(acceptance);
    const reply=after.history.find(e=>e.id===acceptance.payload.responseId);
    assert.ok(reply);
    assert.equal((await tenant(path,{operation:'prepare',action:{kind:'ACCEPTANCE',payload:{text:'I accept this landlord response.',responseId:reply.id}}})).status,400);
    assert.equal((await landlord(path,{operation:'prepare',action:{kind:'RESPONSE',payload:{text:'Synthetic closed dispute must not accept replies.',disputeId:reply.payload.disputeId}}})).status,400);
  } else {
  stage='tenant dispute and landlord response';
  const dispute={kind:'DISPUTE',payload:{deductionId:'fixture-a-deduction',text:'Synthetic tenant dispute: the mark was recorded before move-out. Please review the reports.'}};
  assert.equal((await landlord(path,{operation:'prepare',action:dispute})).status,400);
  let disputeId=after.history.find(e=>e.kind==='DISPUTE' && e.payload.deductionId==='fixture-a-deduction')?.id;
  if(after.settlement.deductions.find(d=>d.id==='fixture-a-deduction').status==='PROPOSED') {
    const p=await prepare(tenant,dispute);assert.equal((await confirm(tenant,p)).status,200);disputeId=p.preview.id;
    assert.equal((await confirm(tenant,p)).status,200);
  }
  assert.ok(disputeId,'Existing dispute must have retained history.');
  const disputed=await detail();assert.equal(disputed.settlement.status,'DISPUTED');
  assert.equal(disputed.settlement.deductions.find(d=>d.id==='fixture-a-deduction').status,'DISPUTED');
  assert.equal(disputed.settlement.recordedRefundSen,before.settlement.recordedRefundSen);
  const reply={kind:'RESPONSE',payload:{disputeId,text:'Synthetic landlord response: I will review the published reports. The dispute is not resolved by this reply.'}};
  assert.equal((await tenant(path,{operation:'prepare',action:reply})).status,400);
  const p=await prepare(landlord,reply);assert.equal((await confirm(landlord,p)).status,200);
  const afterReply=await detail();assert.ok(afterReply.history.some(e=>e.id===p.preview.id));assert.equal(afterReply.settlement.status,'DISPUTED');
  const amountBeforeAcceptance=afterReply.settlement.recordedRefundSen;
  stage='tenant accepts the landlord response and closes the dispute';
  const acceptance={kind:'ACCEPTANCE',payload:{text:'I accept this landlord response.',responseId:p.preview.id}};
  assert.equal((await landlord(path,{operation:'prepare',action:acceptance})).status,400);
  const acceptedPreview=await prepare(tenant,acceptance);
  assert.equal((await detail()).revision,afterReply.revision);
  assert.equal((await confirm(tenant,acceptedPreview)).status,200);
  assert.equal((await confirm(tenant,acceptedPreview)).status,200);
  const final=await detail();
  assert.ok(final.history.some(e=>e.id===acceptedPreview.preview.id&&e.kind==='ACCEPTANCE'));
  assert.equal(final.settlement.status,'AGREED');
  assert.equal(final.settlement.deductions.find(d=>d.id==='fixture-a-deduction').status,'ACCEPTED');
  assert.equal(final.settlement.recordedRefundSen,amountBeforeAcceptance);
  }
  stage='database privilege boundary';
  const settings=parseEnv(readFileSync('.env.records.local','utf8'));db=new PrismaClient({datasources:{db:{url:settings.RECORDS_DATABASE_URL}},log:[]});
  await assert.rejects(db.$executeRaw`UPDATE public."ConditionReport" SET notes=notes WHERE false`);
  await assert.rejects(db.$executeRaw`DELETE FROM public."RecordsActionEvent" WHERE false`);
  const [privileges]=await db.$queryRaw`SELECT has_function_privilege('anon','public.records_submit(text,text,text,integer,text,jsonb)','EXECUTE') AS anon,has_function_privilege('authenticated','public.records_submit(text,text,text,integer,text,jsonb)','EXECUTE') AS authenticated`;
  assert.equal(privileges.anon,false);assert.equal(privileges.authenticated,false);
  await assert.rejects(db.$queryRaw`SELECT public.records_submit('fixture-b-tenant','fixture-a-tenancy',${randomUUID()},0,'REPORT',${JSON.stringify(report.payload)}::jsonb)`);
  console.log('PASS: preview/no-write, explicit confirmation, signature/actor/tenancy protection, concurrent idempotency, stale rejection, persisted reports/disputes/landlord replies/tenant acceptance, dispute closure, unchanged amounts, append-only history, denied direct table writes and public RPC access. Synthetic test submissions retained, not deleted.');
} catch { console.error(`FAIL at ${stage}. Credentials and raw database errors suppressed.`);process.exitCode=1; }
finally { if(db)await db.$disconnect(); }
