import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const output = process.env.RENTALEASE_TEST_OUTPUT;
if (!output) throw new Error('Run npm test to compile the actual workflow helpers.');
const settlement = await import(pathToFileURL(join(output, 'depositSettlementWorkflow.js')).href);
const reports = await import(pathToFileURL(join(output, 'conditionReportWorkflow.js')).href);
const comparison = await import(pathToFileURL(join(output, 'compareConditionReports.js')).href);

test('invalid stored photo references cannot become evidence', () => {
  for (const value of [null, undefined, '', '{', '{}', 'null']) {
    assert.deepEqual(settlement.parseDeductionPhotoIds(value), []);
  }
  assert.deepEqual(settlement.parseDeductionPhotoIds('["photo-1",null,42,{}]'), ['photo-1']);
});

test('attachment returns only supplied evidence, without mutating inputs', () => {
  const deductions = [{ photoIds: '["photo-1","missing"]' }];
  const photos = [{ id: 'photo-1', area: 'Wall', imageUrl: '/synthetic/wall' }];
  assert.deepEqual(settlement.attachEvidencePhotosToDeductions(deductions, photos), [
    { ...deductions[0], evidencePhotos: photos },
  ]);
  assert.equal('evidencePhotos' in deductions[0], false);
});

test('only proposed or disputed deductions are withdrawable', () => {
  for (const status of ['PROPOSED', 'DISPUTED']) assert.equal(settlement.canLandlordWithdrawDeduction(status), true);
  for (const status of ['ACCEPTED', 'WITHDRAWN', '', 'unknown']) assert.equal(settlement.canLandlordWithdrawDeduction(status), false);
});

test('withdrawing the last active deduction results in agreed settlement', () => {
  assert.equal(settlement.getRefundStatusAfterDeductionWithdrawal('DISPUTED', [
    { id: 'wall', status: 'DISPUTED' }, { id: 'old', status: 'WITHDRAWN' },
  ], 'wall'), 'AGREED');
});

test('another unresolved dispute keeps the settlement disputed', () => {
  assert.equal(settlement.getRefundStatusAfterDeductionWithdrawal('DISPUTED', [
    { id: 'wall', status: 'DISPUTED' }, { id: 'floor', status: 'DISPUTED' },
    { id: 'door', status: 'PROPOSED' },
  ], 'wall'), 'DISPUTED');
});

test('remaining proposals preserve initial review or in-review state', () => {
  const deductions = [{ id: 'wall', status: 'DISPUTED' }, { id: 'door', status: 'PROPOSED' }];
  assert.equal(settlement.getRefundStatusAfterDeductionWithdrawal('PROPOSED', deductions, 'wall'), 'PROPOSED');
  assert.equal(settlement.getRefundStatusAfterDeductionWithdrawal('DISPUTED', deductions, 'wall'), 'IN_REVIEW');
});

test('accepted remaining deductions result in agreement, not payment', () => {
  assert.equal(settlement.getRefundStatusAfterDeductionWithdrawal('IN_REVIEW', [
    { id: 'wall', status: 'PROPOSED' }, { id: 'door', status: 'ACCEPTED' },
  ], 'wall'), 'AGREED');
  assert.equal(settlement.getLifecycleCompletionState('AGREED'), null);
  assert.notEqual(settlement.getLifecycleCompletionState('PAID'), null);
});

test('settlement entry requires landlord role and acknowledged move-out', () => {
  assert.equal(settlement.getDepositSettlementEntry({ role: 'TENANT', acknowledgedMoveOut: true }), null);
  assert.equal(settlement.getDepositSettlementEntry({ role: 'LANDLORD', acknowledgedMoveOut: false }), null);
  assert.equal(settlement.getDepositSettlementEntry({ role: 'LANDLORD', acknowledgedMoveOut: true }).label, 'Start Deposit Settlement');
});

test('report creator cannot review their initial submission', () => {
  const context = { createdById: 'tenant', reviewedById: null, currentUserId: 'tenant' };
  assert.equal(reports.canReviewConditionReport({ ...context, status: 'SUBMITTED' }), false);
  assert.equal(reports.canReviewConditionReport({ ...context, currentUserId: 'landlord', status: 'SUBMITTED' }), true);
});

test('counter-evidence review requires a previous reviewer and the other party', () => {
  const context = { status: 'COUNTER_EVIDENCE_ADDED', createdById: 'tenant', currentUserId: 'tenant' };
  assert.equal(reports.canReviewConditionReport({ ...context, reviewedById: null }), false);
  assert.equal(reports.canReviewConditionReport({ ...context, reviewedById: 'tenant' }), false);
  assert.equal(reports.canReviewConditionReport({ ...context, reviewedById: 'landlord' }), true);
});

test('terminal reports remain locked and cannot be reviewed again', () => {
  for (const status of ['ACCEPTED', 'DISPUTED', 'LOCKED']) {
    assert.equal(reports.isConditionReportLocked(status), true);
    assert.equal(reports.canReviewConditionReport({ status, createdById: 'tenant', reviewedById: 'landlord', currentUserId: 'tenant' }), false);
  }
});

test('comparison retains unmatched evidence and warns of disputed baseline', () => {
  const photo = (id, room) => ({ id, room, imageUrl: '/synthetic/' + id, caption: null });
  const result = comparison.groupPhotosForComparison(
    [photo('in-wall', ' Bedroom '), photo('in-kitchen', 'Kitchen')],
    [photo('out-wall', 'bedroom'), photo('out-hall', 'Hall')],
  );
  assert.equal(result.matched.length, 1);
  assert.equal(result.moveInOnly[0].moveInPhotos[0].id, 'in-kitchen');
  assert.equal(result.moveOutOnly[0].moveOutPhotos[0].id, 'out-hall');
  assert.notEqual(comparison.getMoveInBaselineWarning('DISPUTED'), null);
  assert.equal(comparison.getMoveInBaselineWarning('ACCEPTED'), null);
});
