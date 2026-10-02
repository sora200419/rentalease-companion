import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

// Uses the same authenticated application upload route as the UI. No admin key,
// direct storage writes, deletion, or state resets. Explicit --apply required.
const base='http://127.0.0.1:3031';
const assets=[
 ['demo-wall-move-in-W01.png','fixture-b-in'],
 ['demo-wall-move-out-W02.png','fixture-b-out'],
 ['demo-kitchen-move-in-K01.png','fixture-b-in'],
 ['demo-kitchen-move-out-K02.png','fixture-b-out'],
];
let stage='local evidence validation';
try{
 const files=assets.map(([name,reportId])=>{
  const bytes=readFileSync('demo-assets/evidence/'+name);
  assert.ok(bytes.length>100000&&bytes.length<5*1024*1024);
  assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  return {name,reportId,bytes,hash:createHash('sha256').update(bytes).digest('hex')};
 });
 console.log('Synthetic evidence plan: fixture B only; four labelled AI-generated PNGs; move-in/out report pairs. Existing files retained.');
 if(!process.argv.includes('--apply'))console.log('No upload performed. Review demo-assets/evidence/README.md; --apply explicitly confirms this synthetic upload plan.');
 else{
  const jar=new Map();
  async function request(path,options={}){
   const response=await fetch(base+path,{...options,redirect:'manual',signal:AbortSignal.timeout(45000),headers:{Cookie:[...jar].map(([k,v])=>k+'='+v).join('; '),...options.headers}});
   for(const c of response.headers.getSetCookie()){const p=c.split(';')[0],i=p.indexOf('=');jar.set(p.slice(0,i),p.slice(i+1));}
   return response;
  }
  stage='synthetic account sign-in';
  const account=JSON.parse(readFileSync('.local-runtime/records-test-accounts.json','utf8')).find(a=>a.id==='fixture-b-tenant');
  const csrf=await(await request('/api/auth/csrf')).json();
  await request('/api/auth/callback/credentials',{method:'POST',headers:{Origin:base,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({csrfToken:csrf.csrfToken,email:account.email,password:account.password,json:'true'})});
  assert.equal((await request('/api/records')).status,200);
  for(const file of files){
   stage='upload '+file.name;
   const path='/api/records/fixture-b-tenancy/evidence?reportId='+file.reportId;
   const uploaded=await request(path,{method:'POST',headers:{Origin:base,'Content-Type':'image/png','x-file-name':file.name,'x-confirm-upload':'true'},body:file.bytes});
   assert.ok([200,201].includes(uploaded.status));
   const listing=await(await request(path)).json();
   const key='fixture-b-tenant--'+file.hash+'--'+file.name;
   assert.equal(listing.files.filter(f=>f.key===key).length,1);
   const preview=await request(path+'&file='+encodeURIComponent(key)+'&preview=1');
   assert.equal(preview.status,200);assert.equal(preview.headers.get('content-type'),'image/png');
   assert.deepEqual(Buffer.from(await preview.arrayBuffer()),file.bytes);
   console.log('Verified private PNG and byte-exact preview: '+file.name);
  }
  console.log('PASS: all four labelled demo images retained once, in the correct private report folders. No deductions or history changed. Link files through the UI preview/confirmation flow.');
 }
}catch{console.error('FAIL at '+stage+'. Credentials and response bodies suppressed.');process.exitCode=1;}
