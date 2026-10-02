import type { retrieveTenancyRecords, RecordsHistory } from './database';
export type Records = Awaited<ReturnType<typeof retrieveTenancyRecords>>;
export const money = (sen: number) => `MYR ${(sen / 100).toFixed(2)}`;
export function parseMoney(value: string): number | null {
  const match = /^(\d{1,8})(?:\.(\d{1,2}))?$/.exec(value.trim());
  return match ? Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0')) : null;
}
export function eventDeduction(records: Records, event?: RecordsHistory): string | undefined {
  const visited = new Set<string>();
  while (event && !visited.has(event.id)) {
    visited.add(event.id);
    if (event.payload.deductionId) return event.payload.deductionId;
    const parent = event.payload.disputeId ?? event.payload.responseId ?? event.payload.adjustmentId;
    event = records.history.find(e => e.id === parent);
  }
}
export function openDisputes(records: Records) {
  if (records.settlement?.status !== 'DISPUTED') return [];
  return records.history.filter(e => e.kind === 'DISPUTE' && records.settlement?.deductions.some(d => d.id === e.payload.deductionId && d.status === 'DISPUTED'));
}
export function availableResponses(records: Records) {
  const disputes = new Set(openDisputes(records).map(e => e.id));
  return records.history.filter(e => e.kind === 'RESPONSE' && disputes.has(e.payload.disputeId ?? '') &&
    !records.history.some(newer => newer.kind === 'RESPONSE' && newer.payload.disputeId === e.payload.disputeId && newer.revision > e.revision) &&
    !records.history.some(decision => ['ACCEPTANCE','REJECTION'].includes(decision.kind) && decision.payload.responseId === e.id));
}
export function availableAdjustments(records: Records) {
  const open = new Set(openDisputes(records).map(e => e.payload.deductionId));
  return records.history.filter(e => e.kind === 'ADJUSTMENT' && open.has(e.payload.deductionId) &&
    !records.history.some(newer => newer.kind === 'ADJUSTMENT' && newer.payload.deductionId === e.payload.deductionId && newer.revision > e.revision) &&
    !records.history.some(decision => ['ADJUSTMENT_ACCEPTANCE','ADJUSTMENT_REJECTION'].includes(decision.kind) && decision.payload.adjustmentId === e.id));
}
export function revisedRefund(records: Records, deductionId: string, newAmountSen: number) {
  const settlement = records.settlement;
  if (!settlement || !Number.isSafeInteger(newAmountSen) || newAmountSen < 0) throw new Error('Invalid amount.');
  const deduction = settlement.deductions.find(d => d.id === deductionId && d.status !== 'WITHDRAWN');
  if (!deduction) throw new Error('Deduction unavailable.');
  const total = settlement.deductions.filter(d => d.status !== 'WITHDRAWN').reduce((sum,d) => sum + d.amountSen, 0);
  if (settlement.recordedOriginalSen - total !== settlement.recordedRefundSen) throw new Error('Recorded amounts need review before changing a deduction.');
  const refund = settlement.recordedOriginalSen - total + deduction.amountSen - newAmountSen;
  if (refund < 0 || refund > settlement.recordedOriginalSen) throw new Error('The revised total must stay within the deposit.');
  return refund;
}
