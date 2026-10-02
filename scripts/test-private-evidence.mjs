import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const base='http://127.0.0.1:3031';
const accounts=JSON.parse(readFileSync('.local-runtime/records-test-accounts.json','utf8'));
let stage='login';
function client() {
  const jar=new Map();
  return async(path,options={})=>{
    const r=await fetch(base+path,{...options,redirect:'manual',signal:AbortSignal.timeout(45000),headers:{Cookie:[...jar].map(([k,v])=>k+'='+v).join('; '),...options.headers}});
    for(const c of r.headers.getSetCookie()){const p=c.split(';')[0],i=p.indexOf('=');jar.set(p.slice(0,i),p.slice(i+1));}
    return r;
  };
}
async function login(id) {
  const a=accounts.find(a=>a.id===id), request=client();
  const csrf=await(await request('/api/auth/csrf')).json();
  const response=await request('/api/auth/callback/credentials',{method:'POST',headers:{Origin:base,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({csrfToken:csrf.csrfToken,email:a.email,password:a.password,json:'true'})});
  assert.equal(response.status,200);
  assert.equal((await request('/api/records')).status,200);
  return request;
}
try {
  const tenant=await login('fixture-a-tenant'),landlord=await login('fixture-a-landlord'),other=await login('fixture-b-tenant');
  const path='/api/records/fixture-a-tenancy/evidence?reportId=fixture-a-in';
  const bytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aH1EAAAAASUVORK5CYII=','base64');
  const upload={method:'POST',headers:{Origin:base,'Content-Type':'image/png','x-file-name':'synthetic-storage-check.png','x-confirm-upload':'true'},body:bytes};
  stage='authorization and validation';
  assert.equal((await client()(path)).status,401);
  assert.equal((await other(path)).status,404);
  assert.equal((await other(path,upload)).status,404);
  assert.equal((await tenant('/api/records/fixture-a-tenancy/evidence?reportId=fixture-b-in')).status,404);
  assert.equal((await tenant(path,{...upload,headers:{...upload.headers,Origin:'https://other.example'}})).status,403);
  assert.equal((await tenant(path,{...upload,headers:{...upload.headers,'x-confirm-upload':'false'}})).status,400);
  assert.equal((await tenant(path,{...upload,body:Buffer.from('<script>fake png</script>')})).status,400);
  assert.equal((await tenant(path,{...upload,body:Buffer.alloc(5*1024*1024+1)})).status,413);
  stage='private upload and repeat-safe storage';
  const before=await(await tenant(path)).json();
  const saved=await tenant(path,upload); assert.ok([200,201].includes(saved.status));
  assert.equal((await saved.json()).saved,true);
  const repeat=await tenant(path,upload); assert.equal(repeat.status,200); assert.equal((await repeat.json()).replayed,true);
  const listing=await tenant(path); assert.equal(listing.status,200);
  const after=await listing.json(); const file=after.files.find(f=>f.name==='synthetic-storage-check.png');
  assert.ok(file); assert.equal(after.files.filter(f=>f.name===file.name).length,1);
  assert.equal(after.files.length,before.files.some(f=>f.name===file.name)?before.files.length:before.files.length+1);
  assert.ok(!JSON.stringify(after).includes('sb_secret_'));
  const filePath=path+'&file='+encodeURIComponent(file.key);
  stage='authorized downloads preserve bytes and do not expose public links';
  for(const request of [tenant,landlord]){
    const download=await request(filePath);assert.equal(download.status,200);
    assert.match(download.headers.get('content-disposition'),/^attachment/);
    assert.match(download.headers.get('cache-control'),/no-store/);
    assert.equal(download.headers.get('x-content-type-options'),'nosniff');
    assert.deepEqual(Buffer.from(await download.arrayBuffer()),bytes);
  }
  assert.equal((await other(filePath)).status,404);
  assert.equal((await client()(filePath)).status,401);
  stage='authenticated image previews';
  const preview=await tenant(filePath+'&preview=1');
  assert.equal(preview.status,200);
  assert.equal(preview.headers.get('content-type'),'image/png');
  assert.match(preview.headers.get('content-disposition'),/^inline/);
  assert.match(preview.headers.get('cache-control'),/no-store/);
  assert.equal(preview.headers.get('x-content-type-options'),'nosniff');
  assert.deepEqual(Buffer.from(await preview.arrayBuffer()),bytes);
  assert.equal((await other(filePath+'&preview=1')).status,404);
  assert.equal((await client()(filePath+'&preview=1')).status,401);
  stage='previewed evidence links and explicit confirmation';
  const recordPath='/api/records/fixture-a-tenancy';
  const detail=async()=>(await(await tenant(recordPath)).json()).records;
  const post=(request,path,body)=>request(path,{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify(body)});
  const linkAction={kind:'EVIDENCE_LINK',payload:{deductionId:'fixture-a-deduction',reportId:'fixture-a-in',fileKey:file.key,text:'Synthetic evidence reference for the recorded deduction.'}};
  assert.equal((await post(other,recordPath+'/actions',{operation:'prepare',action:linkAction})).status,404);
  assert.equal((await post(tenant,recordPath+'/actions',{operation:'prepare',action:{...linkAction,payload:{...linkAction.payload,reportId:'fixture-b-in'}}})).status,400);
  const initial=await detail();
  let link=initial.history.find(e=>e.kind==='EVIDENCE_LINK'&&e.payload.deductionId==='fixture-a-deduction'&&e.payload.fileKey===file.key);
  if(!link){
    const prepared=await post(tenant,recordPath+'/actions',{operation:'prepare',action:linkAction});
    assert.equal(prepared.status,200);const draft=await prepared.json();
    assert.equal((await detail()).revision,initial.revision);
    assert.equal((await post(tenant,recordPath+'/actions',{operation:'confirm',confirmed:false,token:draft.token})).status,400);
    const confirm={operation:'confirm',confirmed:true,token:draft.token};
    assert.equal((await post(tenant,recordPath+'/actions',confirm)).status,200);
    const replay=await post(tenant,recordPath+'/actions',confirm);assert.equal(replay.status,200);assert.equal((await replay.json()).receipt.replayed,true);
    link=(await detail()).history.find(e=>e.id===draft.preview.id);assert.ok(link);
  }
  const linked=await detail();
  assert.equal(linked.history.filter(e=>e.kind==='EVIDENCE_LINK'&&e.payload.deductionId==='fixture-a-deduction'&&e.payload.fileKey===file.key).length,1);
  assert.ok((await(await landlord(recordPath)).json()).records.history.some(e=>e.id===link.id));
  stage='deduction-scoped answers cite private file references';
  const answer=await post(tenant,recordPath+'/question',{question:'Show evidence for this deduction',deductionId:'fixture-a-deduction'});
  assert.equal(answer.status,200);const content=await answer.json();
  assert.ok(content.answer.sourceIds.includes('file:'+link.id));
  assert.ok(content.answer.sourceIds.includes('fixture-a-in'));
  assert.match(content.answer.text,/have not been analysed/);
  assert.equal((await post(tenant,recordPath+'/question',{question:'Show evidence',deductionId:'fixture-b-deduction'})).status,404);
  assert.equal((await tenant(path+'&file=..%2Fprivate')).status,404);
  const publicResponse=await fetch('https://rgthmushgkithgkmszsy.supabase.co/storage/v1/object/public/rentalease-evidence-dev/fixture-a-tenancy/fixture-a-in/'+file.key,{signal:AbortSignal.timeout(20000)});
  assert.ok(!publicResponse.ok);
  stage='sign-out revokes application downloads';
  const csrf=await(await tenant('/api/auth/csrf')).json();
  await tenant('/api/auth/signout',{method:'POST',headers:{Origin:base,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({csrfToken:csrf.csrfToken,json:'true'})});
  assert.equal((await tenant(filePath)).status,401);
  assert.equal((await tenant(filePath+'&preview=1')).status,401);
  console.log('PASS: private upload and replay, authenticated byte-exact downloads/previews, cross-tenant denial, report scoping, spoofed/oversized rejection, preview/confirm evidence links, durable references in answers, public URL denial and sign-out. Synthetic PNG and append-only link retained.');
} catch { console.error('FAIL at '+stage+'. Credentials and response bodies suppressed.');process.exitCode=1; }
