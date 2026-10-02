import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const { settlementSummary, settlementSummaryText } = await import(pathToFileURL(join(process.env.RENTALEASE_TEST_OUTPUT, 'companion', 'records-summary.js')));
const base = {
  tenancyId: 'case-b', role: 'TENANT', revision: 13, depositSen: 180000,
  settlement: { id: 'settlement-b', status: 'AGREED', recordedOriginalSen: 180000, recordedRefundSen: 175500, paymentRecorded: false, deductions: [
    { id: 'wall', reason: 'Repainting', amountSen: 10000, status: 'WITHDRAWN' },
    { id: 'cleaning', reason: 'Kitchen cleaning', amountSen: 2000, status: 'ACCEPTED' },
    { id: 'key', reason: 'Replacement key', amountSen: 2500, status: 'ACCEPTED' },
  ] }, evidence: [{ id: 'in', kind: 'MOVE_IN', status: 'ACCEPTED', text: 'A recorded mark.', submittedAt: null }], agreement: null, history: [],
};
test('summary reconciles three decisions without charging the withdrawn item or claiming payment', () => {
  const value = settlementSummary(base);
  assert.equal(value.totalSen, 4500); assert.equal(value.resolvedCount, 3);
  assert.equal(value.complete, true); assert.deepEqual(value.warnings, []);
  assert.deepEqual(value.items.map(d => d.contributionSen), [0, 2000, 2500]);
  assert.equal(value.items[0].amountSen, 10000);
  assert.match(value.paymentNotice, /No completed payment/);
});
const disputed = { ...base, settlement: { ...base.settlement, status: 'DISPUTED', recordedRefundSen: 172500,
  deductions: base.settlement.deductions.map(d => d.id === 'cleaning' ? { ...d, amountSen: 5000, status: 'DISPUTED' } : d) },
  history: [
    { id: 'd', kind: 'DISPUTE', payload: { deductionId: 'cleaning', text: 'Please review.' }, revision: 1 },
    { id: 'a', kind: 'ADJUSTMENT', payload: { deductionId: 'cleaning', amountSen: 2000, text: 'New proposal.' }, revision: 2 },
  ] };
test('a pending revised amount is displayed separately, not applied or marked resolved', () => {
  const value = settlementSummary(disputed);
  assert.equal(value.totalSen, 7500); assert.equal(value.items[1].pendingAmountSen, 2000);
  assert.equal(value.resolvedCount, 2); assert.equal(value.complete, false);
  assert.match(value.items[1].next, /accept or reject/);
  assert.match(settlementSummary({ ...disputed, role: 'LANDLORD' }).items[1].next, /Await/);
  assert.match(settlementSummaryText(disputed, '2026-09-26T00:00:00.000Z'), /Pending proposal: MYR 20.00 — NOT applied/);
});
test('rejected and superseded proposals are not presented as current offers', () => {
  const rejected = { ...disputed, history: [...disputed.history, { id: 'r', kind: 'ADJUSTMENT_REJECTION', payload: { adjustmentId: 'a', text: 'No.' }, revision: 3 }] };
  assert.equal(settlementSummary(rejected).items[1].pendingAmountSen, null);
  const newer = { ...disputed, history: [...disputed.history, { ...disputed.history[1], id: 'new', revision: 3, payload: { ...disputed.history[1].payload, amountSen: 1500 } }] };
  assert.equal(settlementSummary(newer).items[1].pendingAmountSen, 1500);
});
test('missing, inconsistent, unsafe and falsely closed records never produce a complete summary', () => {
  const missing = settlementSummary({ ...base, settlement: null });
  assert.equal(missing.complete, false); assert.equal(missing.title, 'No settlement recorded');
  for (const records of [
    { ...base, settlement: { ...base.settlement, recordedRefundSen: 170000 } },
    { ...base, depositSen: 1 },
    { ...base, settlement: { ...base.settlement, recordedOriginalSen: Infinity } },
    { ...disputed, settlement: { ...disputed.settlement, status: 'AGREED' } },
    { ...base, settlement: { ...base.settlement, deductions: [{ ...base.settlement.deductions[0], status: 'UNKNOWN' }] } },
  ]) {
    const summary = settlementSummary(records);
    assert.equal(summary.complete, false); assert.ok(summary.warnings.length);
  }
  assert.match(settlementSummaryText({ ...base, settlement: null }, 'now'), /Recorded refund: Not recorded/);
});
test('export follows parent decisions, sorts chronologically and quotes user text without object keys or actor identities', () => {
  const records = { ...base, history: [
    { id: 'accept', kind: 'ACCEPTANCE', actorId: 'private-actor', revision: 3, createdAt: '2026-09-26', payload: { responseId: 'reply', text: 'Accepted.\nFAKE SYSTEM HEADING' }, effects: { beforeRefundSen: 172500, afterRefundSen: 175500 } },
    { id: 'reply', kind: 'RESPONSE', revision: 2, createdAt: '2026-09-25', payload: { disputeId: 'dispute', text: 'Reply.' } },
    { id: 'dispute', kind: 'DISPUTE', revision: 1, createdAt: '2026-09-24', payload: { deductionId: 'cleaning', text: 'Dispute.' } },
    { id: 'file', kind: 'EVIDENCE_LINK', revision: 4, payload: { deductionId: 'cleaning', reportId: 'in', fileKey: 'private-actor--hash-value--kitchen.png', text: 'Photo.' } },
  ] };
  const before = JSON.stringify(records);
  const text = settlementSummaryText(records, '2026-09-26T00:00:00.000Z');
  assert.equal(JSON.stringify(records), before);
  assert.ok(text.indexOf('Event: dispute') < text.indexOf('Event: reply'));
  assert.ok(text.indexOf('Event: reply') < text.indexOf('Event: accept'));
  assert.match(text, /Event: accept · Deduction: cleaning/);
  assert.match(text, /\n  \| FAKE SYSTEM HEADING/);
  assert.match(text, /kitchen.png/); assert.match(text, /Report: in · Link event: file/);
  assert.ok(!text.includes('private-actor')); assert.ok(!text.includes('hash-value'));
  const items = settlementSummary(records).items;
  assert.equal(items[0].sources.length, 0); assert.equal(items[1].sources.length, 1);
  assert.match(text, /NOT A PAYMENT RECEIPT/);
});
test('a recorded payment is distinguished from independent verification', () => {
  const value = settlementSummary({ ...base, settlement: { ...base.settlement, status: 'PAID', paymentRecorded: true } });
  assert.equal(value.complete, true); assert.match(value.paymentNotice, /does not independently verify/);
});
