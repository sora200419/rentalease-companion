import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
const config = parseEnv(readFileSync('.env.records.local','utf8'));
const bucketName = 'rentalease-evidence-dev';
let stage='configuration'; let status;
try {
  if (config.SUPABASE_URL !== 'https://rgthmushgkithgkmszsy.supabase.co' || !config.SUPABASE_SERVICE_ROLE_KEY?.startsWith('sb_secret_')) throw new Error();
  const call = (path,init={}) => fetch(config.SUPABASE_URL+'/storage/v1/'+path,{
    ...init,headers:{...init.headers,apikey:config.SUPABASE_SERVICE_ROLE_KEY},redirect:'error',signal:AbortSignal.timeout(30000),
  });
  stage='list buckets';
  const listing=await call('bucket'); status=listing.status;
  if(!listing.ok) throw new Error();
  let bucket=(await listing.json()).find(b=>b.id===bucketName);
  if(!bucket){
    if(!process.argv.includes('--apply')) { console.log('Private evidence bucket is not provisioned. Use --apply to create the scoped development bucket.'); process.exit(0); }
    stage='create private bucket';
    const result=await call('bucket',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
      id:bucketName,name:bucketName,public:false,file_size_limit:5*1024*1024,allowed_mime_types:['image/png','image/jpeg','application/pdf'],
    })});
    status=result.status; if(!result.ok) throw new Error();
    const verified=await call('bucket/'+bucketName); if(!verified.ok)throw new Error();
    bucket=await verified.json();
  }
  stage='verify private bucket';
  if(bucket.public!==false || Number(bucket.file_size_limit)!==5*1024*1024) throw new Error();
  console.log('Private development evidence bucket ready; 5 MB per file, PNG/JPEG/PDF, no public access.');
} catch { console.error(JSON.stringify({stage,status,error:'Storage setup unavailable. Credentials and response contents suppressed.'}));process.exitCode=1; }
