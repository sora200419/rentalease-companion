import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { recordsAuthOptions } from '@/lib/companion/records-auth';
import { recordsDb } from '@/lib/companion/records-client';
import { retrieveTenancyRecords } from '@/lib/companion/database';
import { assertPrivateEvidenceBucket, evidencePrefix, EVIDENCE_BUCKET, evidenceObjectName, listEvidence, MAX_EVIDENCE_BYTES, storageRequest, validateEvidence, validEvidenceObjectName } from '@/lib/companion/private-evidence';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
type Context = { params: Promise<{ tenancyId: string }> };
const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };
class EvidenceError extends Error { constructor(message: string, public status: number) { super(message); } }
const fail = (error: unknown) => NextResponse.json({ error: error instanceof EvidenceError ? error.message : 'Private evidence is unavailable. Refresh the file list before retrying an upload.' }, { status: error instanceof EvidenceError ? error.status : 503, headers });
async function authorize(request: Request, context: Context) {
  if (process.env.COMPANION_RECORDS_MODE !== '1') throw new EvidenceError('Unavailable.',404);
  if (request.headers.get('host') !== '127.0.0.1:3031' || request.headers.get('sec-fetch-site') === 'cross-site') throw new EvidenceError('Local access required.',403);
  const session = await getServerSession(recordsAuthOptions);
  if (!session?.user.id) throw new EvidenceError('Sign in to access evidence.',401);
  const { tenancyId } = await context.params;
  const reportId = new URL(request.url).searchParams.get('reportId') ?? '';
  let prefix: string;
  try { prefix = evidencePrefix(tenancyId,reportId); } catch { throw new EvidenceError('Evidence unavailable.',404); }
  let records;
  try { records = await retrieveTenancyRecords(recordsDb(),session.user.id,tenancyId); }
  catch (error) { if (error instanceof Error && error.message === 'Tenancy unavailable.') throw new EvidenceError('Evidence unavailable.',404); throw error; }
  if (!records.evidence.some(e => e.id === reportId)) throw new EvidenceError('Evidence unavailable.',404);
  return { prefix, actorId: session.user.id };
}
export async function GET(request: Request, context: Context) {
  try {
    const { prefix } = await authorize(request,context);
    const file = new URL(request.url).searchParams.get('file');
    if (file && !validEvidenceObjectName(file)) throw new EvidenceError('File unavailable.',404);
    await assertPrivateEvidenceBucket();
    if (!file) return NextResponse.json({ files: await listEvidence(prefix) },{ headers });
    const response = await storageRequest('object/authenticated/' + EVIDENCE_BUCKET + '/' + prefix + '/' + file);
    if (!response.ok || !response.body) throw new EvidenceError('File unavailable.',404);
    const reader=response.body.getReader(); const chunks:Uint8Array[]=[]; let size=0;
    while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX_EVIDENCE_BYTES){await reader.cancel();throw new EvidenceError('File exceeds the allowed size.',413);}chunks.push(value);}
    const bytes=Buffer.concat(chunks);
    const mime=file.endsWith('.png')?'image/png':file.endsWith('.jpg')?'image/jpeg':'application/pdf';
    const info=validateEvidence(bytes,mime,file.split('--').slice(2).join('--'));
    if(info.hash!==file.split('--')[1])throw new EvidenceError('File integrity check failed.',409);
    const preview=new URL(request.url).searchParams.get('preview')==='1';
    if(preview && mime==='application/pdf')throw new EvidenceError('Download PDFs to read them. Image previews support PNG and JPEG.',415);
    return new Response(bytes,{ headers: { ...headers,
      'Content-Type': preview?mime:'application/octet-stream',
      'Cross-Origin-Resource-Policy':'same-origin',
      'Content-Disposition': (preview?'inline':'attachment')+'; filename="' + info.name + '"',
      'Content-Security-Policy': "sandbox; default-src 'none'",
    } });
  } catch (error) { return fail(error); }
}
// Loopback development server: serializes uploads for one report and limits bursts.
const shared = globalThis as unknown as { evidenceUploads?: Set<string>; evidenceRates?: Map<string,{count:number;until:number}> };
const uploads = shared.evidenceUploads ??= new Set();
const rates = shared.evidenceRates ??= new Map();
export async function POST(request: Request, context: Context) {
  let locked: string | undefined;
  try {
    if (request.headers.get('origin') !== 'http://127.0.0.1:3031') throw new EvidenceError('Same-origin upload required.',403);
    const { prefix, actorId } = await authorize(request,context);
    if (request.headers.get('x-confirm-upload') !== 'true') throw new EvidenceError('Confirm the file upload first.',400);
    if (uploads.has(prefix)) throw new EvidenceError('An upload is running. Please wait.',429);
    uploads.add(prefix); locked = prefix;
    const now = Date.now();
    for (const [id,value] of rates) if (value.until <= now) rates.delete(id);
    const rate = rates.get(actorId) ?? { count: 0, until: now + 60000 };
    rates.set(actorId,rate);
    if (++rate.count > 10) throw new EvidenceError('Please wait a minute before uploading more files.',429);
    const reader = request.body?.getReader();
    if (!reader) throw new EvidenceError('Choose a file.',400);
    const chunks: Uint8Array[] = []; let size = 0;
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > MAX_EVIDENCE_BYTES) { await reader.cancel(); throw new EvidenceError('File exceeds 5 MB.',413); }
      chunks.push(value);
    }
    const bytes = Buffer.concat(chunks);
    let info;
    try { info = validateEvidence(bytes,request.headers.get('content-type') ?? '',decodeURIComponent(request.headers.get('x-file-name') ?? 'evidence')); }
    catch { throw new EvidenceError('Choose a valid PNG, JPEG or PDF file up to 5 MB.',400); }
    const name = evidenceObjectName(actorId,info);
    await assertPrivateEvidenceBucket();
    const files = await listEvidence(prefix);
    if (files.some(f => f.key === name)) return NextResponse.json({ saved: true, replayed: true },{ headers });
    if (files.length >= 50) throw new EvidenceError('This report has reached its 50-file development limit.',409);
    const response = await storageRequest('object/' + EVIDENCE_BUCKET + '/' + prefix + '/' + name, {
      method: 'POST', headers: { 'Content-Type': info.mime, 'x-upsert': 'false' }, body: bytes,
    });
    if (!response.ok) {
      // A network retry may find a committed upload. Never overwrite it.
      if ((await listEvidence(prefix)).some(f => f.key === name)) return NextResponse.json({ saved: true, replayed: true },{ headers });
      throw new Error('Upload unavailable.');
    }
    return NextResponse.json({ saved: true, replayed: false },{ status: 201, headers });
  } catch (error) { return fail(error); }
  finally { if (locked) uploads.delete(locked); }
}
