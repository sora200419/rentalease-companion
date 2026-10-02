import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import type { retrieveTenancyRecords, RecordsHistory } from './database';
import { openDisputes, availableResponses, availableAdjustments, revisedRefund, eventDeduction } from './records-workflow';
export type ActionKind = RecordsHistory['kind'];
export type ActionInput = { kind: ActionKind; payload: RecordsHistory['payload'] };
type Prepared = ActionInput & { actorId: string; tenancyId: string; revision: number; id: string; expiresAt: number };
const fields: Record<ActionKind,string[]> = {
  REPORT:['text','reportType'], DISPUTE:['text','deductionId'], RESPONSE:['text','disputeId'],
  ACCEPTANCE:['text','responseId'], REJECTION:['text','responseId'], WITHDRAWAL:['text','deductionId'],
  ADJUSTMENT:['text','deductionId','amountSen'], ADJUSTMENT_ACCEPTANCE:['text','adjustmentId'],
  ADJUSTMENT_REJECTION:['text','adjustmentId'], DEDUCTION_ACCEPTANCE:['text','deductionId'],
  EVIDENCE_LINK:['text','deductionId','reportId','fileKey'],
};
export function parseAction(value: unknown): ActionInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid submission.');
  const v = value as Record<string,unknown>;
  if (Object.keys(v).some(k => !['kind','payload'].includes(k)) || typeof v.kind !== 'string' || !Object.prototype.hasOwnProperty.call(fields,v.kind) || !v.payload || typeof v.payload !== 'object' || Array.isArray(v.payload)) throw new Error('Invalid submission.');
  const kind = v.kind as ActionKind;
  const p = v.payload as Record<string,unknown>;
  if (Object.keys(p).some(k => !fields[kind].includes(k)) || fields[kind].some(k => !(k in p)) || typeof p.text !== 'string' || p.text.trim().length < 10 || p.text.length > 2000) throw new Error('Invalid submission.');
  for (const field of fields[kind].filter(k => k.endsWith('Id'))) {
    if (typeof p[field] !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(p[field] as string)) throw new Error('Invalid reference.');
  }
  if (kind === 'ADJUSTMENT' && (!Number.isSafeInteger(p.amountSen) || (p.amountSen as number) < 1 || (p.amountSen as number) > 9999999999)) throw new Error('Invalid amount.');
  if (kind === 'REPORT' && !['MOVE_IN','MOVE_OUT','INSPECTION'].includes(String(p.reportType))) throw new Error('Invalid report type.');
  if (kind === 'EVIDENCE_LINK' && (typeof p.fileKey !== 'string' || !/^fixture-[ab]-(tenant|landlord)--[a-f0-9]{64}--[a-zA-Z0-9_-]{1,70}\.(png|jpg|pdf)$/.test(p.fileKey))) throw new Error('Invalid file reference.');
  const fixed: Partial<Record<ActionKind,string>> = {
    ACCEPTANCE:'I accept this landlord response.',
    ADJUSTMENT_ACCEPTANCE:'I accept this proposed deduction amount.',
    DEDUCTION_ACCEPTANCE:'I accept this recorded deduction.',
  };
  if (fixed[kind] && p.text.trim() !== fixed[kind]) throw new Error('Explicit acceptance required.');
  return { kind, payload: { ...p, text: p.text.trim() } as ActionInput['payload'] };
}
export function validateAction(records: Awaited<ReturnType<typeof retrieveTenancyRecords>>, action: ActionInput) {
  if (!['fixture-a-tenancy','fixture-b-tenancy'].includes(records.tenancyId)) throw new Error('Writes are limited to development fixtures.');
  validateWorkflowAction(records, action);
}
// Pure business rules shared by the isolated demo. Database writers must use
// validateAction above, which retains the additional fixture allowlist.
export function validateWorkflowAction(records: Awaited<ReturnType<typeof retrieveTenancyRecords>>, action: ActionInput) {
  if (!['TENANT','LANDLORD'].includes(records.role)) throw new Error('Role unavailable.');
  if (action.kind === 'REPORT') return;
  const settlement = records.settlement;
  const fail = () => { throw new Error('Action unavailable for the current role or record status.'); };
  if (!settlement) return fail();
  const deduction = settlement.deductions.find(d => d.id === action.payload.deductionId);
  if (action.kind === 'EVIDENCE_LINK') {
    if (!deduction || !records.evidence.some(e => e.id === action.payload.reportId)) return fail();
    if (records.history.some(e => e.kind === 'EVIDENCE_LINK' && e.payload.deductionId === deduction.id && e.payload.reportId === action.payload.reportId && e.payload.fileKey === action.payload.fileKey)) return fail();
    return;
  }
  if (!['PROPOSED','IN_REVIEW','DISPUTED'].includes(settlement.status)) return fail();
  if (['DISPUTE','DEDUCTION_ACCEPTANCE'].includes(action.kind) && (records.role !== 'TENANT' || deduction?.status !== 'PROPOSED')) return fail();
  if (action.kind === 'WITHDRAWAL') {
    if (records.role !== 'LANDLORD' || !deduction || !['PROPOSED','DISPUTED'].includes(deduction.status)) return fail();
    revisedRefund(records,deduction.id,0);
  }
  if (action.kind === 'ADJUSTMENT') {
    if (records.role !== 'LANDLORD' || !deduction || deduction.status !== 'DISPUTED' || !openDisputes(records).some(e => e.payload.deductionId === deduction.id)) return fail();
    if (action.payload.amountSen === deduction.amountSen) return fail();
    revisedRefund(records,deduction.id,action.payload.amountSen ?? -1);
  }
  if (action.kind === 'RESPONSE' && (records.role !== 'LANDLORD' || !openDisputes(records).some(e => e.id === action.payload.disputeId))) return fail();
  if (['ACCEPTANCE','REJECTION'].includes(action.kind)) {
    const response = availableResponses(records).find(e => e.id === action.payload.responseId);
    if (records.role !== 'TENANT' || !response) return fail();
    if (action.kind === 'ACCEPTANCE' && availableAdjustments(records).some(e => e.payload.deductionId === eventDeduction(records,response))) return fail();
  }
  if (['ADJUSTMENT_ACCEPTANCE','ADJUSTMENT_REJECTION'].includes(action.kind)) {
    const proposal = availableAdjustments(records).find(e => e.id === action.payload.adjustmentId);
    if (records.role !== 'TENANT' || !proposal) return fail();
    if (action.kind === 'ADJUSTMENT_ACCEPTANCE') revisedRefund(records,proposal.payload.deductionId!,proposal.payload.amountSen!);
  }
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
