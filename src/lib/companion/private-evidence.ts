import { createHash } from 'node:crypto';

export const EVIDENCE_BUCKET = 'rentalease-evidence-dev';
export const MAX_EVIDENCE_BYTES = 5 * 1024 * 1024;
export const EVIDENCE_TYPES = ['image/png', 'image/jpeg', 'application/pdf'];
export function evidenceConfig() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url !== 'https://rgthmushgkithgkmszsy.supabase.co' || !key?.startsWith('sb_secret_')) throw new Error('Private storage configuration unavailable.');
  return { url, key };
}
export function validateEvidence(bytes: Uint8Array, mime: string, name: string) {
  if (!bytes.length || bytes.length > MAX_EVIDENCE_BYTES) throw new Error('Choose a non-empty file up to 5 MB.');
  const buffer = Buffer.from(bytes);
  const detected = buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ? 'image/png'
    : buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255 ? 'image/jpeg'
    : buffer.subarray(0,5).toString('ascii') === '%PDF-' ? 'application/pdf' : '';
  if (!EVIDENCE_TYPES.includes(mime) || detected !== mime) throw new Error('Only PNG, JPEG and PDF files with matching content are supported.');
  const extension = mime === 'image/png' ? '.png' : mime === 'image/jpeg' ? '.jpg' : '.pdf';
  const stem = name.replace(/\.[^.]*$/, '').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0,70) || 'evidence';
  return { name: stem + extension, mime, size: buffer.length, hash: createHash('sha256').update(buffer).digest('hex') };
}
export function evidenceObjectName(actor: string, file: ReturnType<typeof validateEvidence>) {
  if (!/^fixture-[ab]-(tenant|landlord)$/.test(actor)) throw new Error('Development account required.');
  return actor + '--' + file.hash + '--' + file.name;
}
export function validEvidenceObjectName(name: string) {
  return /^fixture-[ab]-(tenant|landlord)--[a-f0-9]{64}--[a-zA-Z0-9_-]{1,70}\.(png|jpg|pdf)$/.test(name);
}
export function evidencePrefix(tenancyId: string, reportId: string) {
  if (!['fixture-a-tenancy','fixture-b-tenancy'].includes(tenancyId) || !/^[a-zA-Z0-9_-]{1,100}$/.test(reportId)) throw new Error('Evidence unavailable.');
  return tenancyId + '/' + reportId;
}
export async function storageRequest(path: string, init: RequestInit = {}) {
  const { url, key } = evidenceConfig();
  return fetch(url + '/storage/v1/' + path, {
    ...init, headers: { ...init.headers, apikey: key },
    redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(30000),
  });
}
export async function assertPrivateEvidenceBucket() {
  const response = await storageRequest('bucket/' + EVIDENCE_BUCKET);
  if (!response.ok) throw new Error('Private storage unavailable.');
  const bucket = await response.json();
  if (bucket.public !== false || Number(bucket.file_size_limit) > MAX_EVIDENCE_BYTES || !bucket.file_size_limit) throw new Error('Private storage configuration unavailable.');
}
export type EvidenceFile = { key: string; name: string; uploadedAt: string; size: number; uploadedBy: string };
export async function listEvidence(prefix: string): Promise<EvidenceFile[]> {
  const response = await storageRequest('object/list/' + EVIDENCE_BUCKET, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prefix: prefix + '/', limit: 100, sortBy: { column: 'created_at', order: 'desc' } }),
  });
  if (!response.ok) throw new Error('Private files unavailable.');
  const files = await response.json() as { name: string; created_at: string; metadata?: { size?: number } }[];
  if (!Array.isArray(files)) throw new Error('Private files unavailable.');
  return files.filter(f => validEvidenceObjectName(f.name)).map(f => ({
    key: f.name, name: f.name.split('--').slice(2).join('--'), uploadedBy: f.name.split('--')[0],
    uploadedAt: f.created_at, size: Number(f.metadata?.size ?? 0),
  }));
}
