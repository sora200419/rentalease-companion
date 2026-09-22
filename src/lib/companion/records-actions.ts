import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import type { retrieveTenancyRecords } from './database';
export type ActionInput = { kind: 'REPORT' | 'DISPUTE' | 'RESPONSE'; payload: { text: string; reportType?: 'MOVE_IN' | 'MOVE_OUT' | 'INSPECTION'; deductionId?: string; disputeId?: string } };
type Prepared = ActionInput & { actorId: string; tenancyId: string; revision: number; id: string; expiresAt: number };
export function parseAction(value: unknown): ActionInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid submission.');
  const v = value as Record<string, unknown>;
  if (Object.keys(v).some(k => !['kind','payload'].includes(k)) || !['REPORT','DISPUTE','RESPONSE'].includes(String(v.kind)) || !v.payload || typeof v.payload !== 'object' || Array.isArray(v.payload)) throw new Error('Invalid submission.');
  const p = v.payload as Record<string, unknown>;
  const field = v.kind === 'REPORT' ? 'reportType' : v.kind === 'DISPUTE' ? 'deductionId' : 'disputeId';
  if (Object.keys(p).some(k => !['text',field].includes(k)) || typeof p.text !== 'string' || p.text.trim().length < 10 || p.text.length > 2000 || typeof p[field] !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(p[field] as string)) throw new Error('Invalid submission.');
  if (v.kind === 'REPORT' && !['MOVE_IN','MOVE_OUT','INSPECTION'].includes(String(p.reportType))) throw new Error('Invalid submission.');
  return { kind: v.kind, payload: { ...p, text: p.text.trim() } } as ActionInput;
}
export function validateAction(records: Awaited<ReturnType<typeof retrieveTenancyRecords>>, action: ActionInput) {
  if (!['fixture-a-tenancy','fixture-b-tenancy'].includes(records.tenancyId)) throw new Error('Writes are limited to development fixtures.');
  if (action.kind === 'DISPUTE' && (records.role !== 'TENANT' || !records.settlement || !['PROPOSED','IN_REVIEW','DISPUTED'].includes(records.settlement.status) || !records.settlement.deductions.some(d => d.id === action.payload.deductionId && d.status === 'PROPOSED'))) throw new Error('Action unavailable for the current role or record status.');
  if (action.kind === 'RESPONSE' && (records.role !== 'LANDLORD' || !records.history.some(e => e.id === action.payload.disputeId && e.kind === 'DISPUTE'))) throw new Error('Action unavailable for the current role or record status.');
}
function sign(value: string, secret: string) {
  if (secret.length < 32) throw new Error('Signing configuration unavailable.');
  return createHmac('sha256', secret).update('records-action-v1\0' + value).digest();
}
export function prepareActionToken(action: ActionInput, actorId: string, tenancyId: string, revision: number, secret: string, now = Date.now()) {
  const preview: Prepared = { ...parseAction(action), actorId, tenancyId, revision, id: randomUUID(), expiresAt: now + 10 * 60000 };
  const encoded = Buffer.from(JSON.stringify(preview)).toString('base64url');
  return { token: `${encoded}.${sign(encoded, secret).toString('base64url')}`, preview };
}
export function verifyActionToken(token: string, actorId: string, tenancyId: string, secret: string, now = Date.now()): Prepared {
  if (token.length > 14000) throw new Error('Invalid confirmation.');
  const [encoded, signature, extra] = token.split('.');
  if (!encoded || !signature || extra) throw new Error('Invalid confirmation.');
  const expected = sign(encoded, secret); const supplied = Buffer.from(signature, 'base64url');
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) throw new Error('Invalid confirmation.');
  const p: Prepared = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
  if (p.actorId !== actorId || p.tenancyId !== tenancyId || !Number.isSafeInteger(p.revision) || p.revision < 0 || p.expiresAt <= now || !Number.isFinite(p.expiresAt)) throw new Error('Expired or mismatched confirmation.');
  parseAction({ kind: p.kind, payload: p.payload }); return p;
}
