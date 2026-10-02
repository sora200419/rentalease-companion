import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const get = file => import(pathToFileURL(join(process.env.RENTALEASE_TEST_OUTPUT, 'companion', file + '.js')));
const { newJudgeSession, applyJudgeCommand, judgeSnapshot, judgeOptions } = await get('judge-demo');
const { JudgeStore } = await get('judge-store');
const { routeDialogue } = await get('records-dialogue');
const { answerDeductionQuestion } = await get('records-evidence');
const { validateAction } = await get('records-actions');
const { settlementSummary } = await get('records-summary');
function runner(scenario) {
  let state = newJudgeSession(scenario);
  const run = (op, input = {}) => state = applyJudgeCommand(state, op, { revision: state.revision, ...input });
  const decide = (kind, payload) => {
    const before = structuredClone(state.records);
    run('prepare', { action: { kind, payload } });
    assert.deepEqual(state.records, before, 'preview must not change business records');
    run('confirm', { id: state.pending.id });
  };
  return { run, decide, get state() { return state; } };
}
const dispute = deductionId => ({ deductionId, text: 'Please review this synthetic deduction.' });
const accepted = deductionId => ({ deductionId, text: 'I accept this recorded deduction.' });

test('complete independent three-item case: reject reply and offer, revise, accept, withdraw, close', () => {
  const d = runner();
  d.decide('DISPUTE', dispute('wall'));
  d.run('select', { deductionId: 'cleaning' }); d.decide('DISPUTE', dispute('cleaning'));
  d.run('role', { role: 'LANDLORD' });
  const disputeId = d.state.records.history.find(e => e.kind === 'DISPUTE' && e.payload.deductionId === 'cleaning').id;
  d.decide('RESPONSE', { disputeId, text: 'Please review the reported counter residue.' });
  const responseId = d.state.records.history.at(-1).id;
  d.run('role', { role: 'TENANT' }); d.decide('REJECTION', { responseId, text: 'The cleaning statement still needs review.' });
  assert.equal(d.state.records.settlement.deductions[1].status, 'DISPUTED');
  d.run('role', { role: 'LANDLORD' });
  d.decide('ADJUSTMENT', { deductionId: 'cleaning', text: 'Propose a smaller cleaning deduction.', amountSen: 3000 });
  let adjustmentId = d.state.records.history.at(-1).id;
  assert.equal(d.state.records.settlement.recordedRefundSen, 162500);
  d.run('role', { role: 'TENANT' }); d.decide('ADJUSTMENT_REJECTION', { adjustmentId, text: 'This proposed amount needs further review.' });
  d.run('role', { role: 'LANDLORD' }); d.decide('ADJUSTMENT', { deductionId: 'cleaning', text: 'Offer MYR 20 for this synthetic case.', amountSen: 2000 });
  adjustmentId = d.state.records.history.at(-1).id;
  d.run('role', { role: 'TENANT' }); d.decide('ADJUSTMENT_ACCEPTANCE', { adjustmentId, text: 'I accept this proposed deduction amount.' });
  d.run('select', { deductionId: 'key' }); d.decide('DEDUCTION_ACCEPTANCE', accepted('key'));
  d.run('role', { role: 'LANDLORD' }); d.run('select', { deductionId: 'wall' });
  d.decide('WITHDRAWAL', { deductionId: 'wall', text: 'Withdraw the synthetic wall deduction.' });
  assert.deepEqual(d.state.records.settlement.deductions.map(d => d.status), ['WITHDRAWN', 'ACCEPTED', 'ACCEPTED']);
  assert.equal(d.state.records.settlement.recordedRefundSen, 175500);
  assert.equal(d.state.records.settlement.status, 'AGREED');
  assert.equal(d.state.records.settlement.paymentRecorded, false);
  assert.equal(settlementSummary(d.state.records).complete, true);
  assert.equal(judgeOptions(d.state.records, 'wall').length, 0);
  assert.equal(d.state.records.history.filter(e => e.kind !== 'EVIDENCE_LINK').length, 10);
});
test('tenant can accept a reply at original amount when no revised offer is pending', () => {
  const d = runner(); d.decide('DISPUTE', dispute('wall')); const disputeId = d.state.records.history.at(-1).id;
  d.run('role', { role: 'LANDLORD' }); d.decide('RESPONSE', { disputeId, text: 'Please reconsider this recorded deduction.' });
  const responseId = d.state.records.history.at(-1).id;
  d.run('role', { role: 'TENANT' }); d.decide('ACCEPTANCE', { responseId, text: 'I accept this landlord response.' });
  assert.equal(d.state.records.settlement.deductions[0].status, 'ACCEPTED');
  assert.equal(d.state.records.settlement.recordedRefundSen, 162500);
});
test('cancel, refresh, context change and role switch invalidate previews but retain all records', () => {
  for (const [op, input] of [['cancel', {}], ['resume', {}], ['select', { deductionId: 'key' }], ['role', { role: 'LANDLORD' }]]) {
    const d = runner(); const history = structuredClone(d.state.records.history);
    d.run('prepare', { action: { kind: 'DISPUTE', payload: dispute('wall') } }); const id = d.state.pending.id;
    d.run(op, input); assert.equal(d.state.pending, null);
    assert.deepEqual(d.state.records.history, history); assert.equal(d.state.records.revision, 0);
    assert.throws(() => d.run('confirm', { id }));
  }
});
test('confirmation rejects expiration, altered IDs, stale revision and role injection; retries are idempotent', () => {
  const d = runner(); d.run('prepare', { action: { kind: 'DISPUTE', payload: dispute('wall') } });
  const id = d.state.pending.id;
  assert.throws(() => applyJudgeCommand(d.state, 'confirm', { revision: 0, id }));
  assert.throws(() => d.run('confirm', { id, role: 'LANDLORD' }));
  assert.throws(() => d.run('confirm', { id: 'not-the-preview' }));
  assert.throws(() => applyJudgeCommand({ ...d.state, pending: { ...d.state.pending, expiresAt: 1 } }, 'confirm', { revision: d.state.revision, id }));
  d.run('confirm', { id }); const saved = d.state;
  assert.deepEqual(applyJudgeCommand(saved, 'confirm', { revision: 0, id }), saved);
});
test('isolated demo cannot pass development database fixture guard', () => {
  assert.throws(() => validateAction(newJudgeSession().records, { kind: 'DISPUTE', payload: dispute('wall') }), /development fixtures/);
});
test('chat only chooses context: an imperative never prepares or confirms and history is role-specific', () => {
  const d = runner(); const before = structuredClone(d.state.records);
  d.run('chat', { question: 'Accept the second deduction' });
  assert.equal(d.state.pending, null); assert.equal(d.state.selected, 'cleaning');
  assert.deepEqual(d.state.records, before);
  assert.equal(judgeSnapshot(d.state).messages.length, 1);
  d.run('role', { role: 'LANDLORD' }); assert.equal(judgeSnapshot(d.state).messages.length, 0);
});
test('wrong role, unknown action, other item and zero or unsupported proposal fail without mutation', () => {
  const d = runner(); const before = JSON.stringify(d.state);
  for (const action of [
    { kind: 'WITHDRAWAL', payload: { deductionId: 'wall', text: 'Remove this deduction please.' } },
    { kind: 'DEDUCTION_ACCEPTANCE', payload: accepted('cleaning') },
    { kind: 'PAY', payload: { text: 'Transfer the refund now.' } },
    { kind: 'REPORT', payload: { text: 'Synthetic report text.', reportType: 'MOVE_IN' } },
    { kind: 'ADJUSTMENT', payload: { ...dispute('wall'), amountSen: 0 } },
  ]) assert.throws(() => d.run('prepare', { action }));
  assert.equal(JSON.stringify(d.state), before);
});
test('local file store preserves sessions across restart, separates scenarios and serializes stale tabs', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'rentalease-judge-'));
  try {
    const store = new JudgeStore(directory), first = await store.create();
    const results = await Promise.allSettled([
      store.execute(first.id, 'select', { revision: 0, deductionId: 'key' }),
      store.execute(first.id, 'select', { revision: 0, deductionId: 'cleaning' }),
    ]);
    assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
    const restarted = new JudgeStore(directory);
    assert.equal((await restarted.read(first.id)).selected, 'key');
    const second = await restarted.create('MISSING');
    assert.notEqual(second.id, first.id);
    assert.equal((await restarted.read(first.id)).scenario, 'STANDARD');
    assert.equal((await readdir(directory)).filter(f => f.endsWith('.json')).length, 2);
    await assert.rejects(restarted.read('../anything'));
    const prepared = await restarted.execute(first.id, 'prepare', { revision: 1, action: { kind: 'DISPUTE', payload: dispute('key') } });
    await assert.rejects(restarted.execute(second.id, 'confirm', { revision: 0, id: prepared.pending.id }));
  } finally { await rm(directory, { recursive: true, force: true }); }
});
for (const scenario of ['STANDARD', 'MISSING', 'CONFLICTING']) test('bundled evidence provenance and citations: ' + scenario, () => {
  const s = newJudgeSession(scenario), answer = answerDeductionQuestion(s.records, 'wall', 'Show evidence');
  const ids = new Set(['wall', ...s.records.evidence.map(e => e.id), ...s.records.history.map(e => 'file:' + e.id)]);
  assert.ok(answer.sourceIds.every(id => ids.has(id))); assert.match(answer.text, /do not establish liability/);
  if (scenario === 'MISSING') {
    assert.equal(judgeSnapshot(s).photos.length, 2); assert.ok(!answer.sourceIds.includes('move-in'));
    assert.match(answer.text, /No published move-in/);
  }
  if (scenario === 'CONFLICTING') {
    assert.ok(answer.sourceIds.includes('tenant-account')); assert.match(answer.text, /both keys were returned/);
    assert.match(answer.text, /a missing key/); assert.match(answer.text, /no conflict has been resolved/);
  }
});
const ambiguous = [
  'Accept the second deduction and dispute the first', '第二项接受，第一项不同意',
  'Accept the kitchen cleaning and reject the wall', 'Accept the first deduction for cleaning',
  'Accept item 1 and item 3', 'I accept the wall or the key', 'I agree if you remove the key charge',
  'Accept MYR 20 to 30', 'Accept MYR 50 and MYR 100', 'Accept $50', 'Accept MYR -50',
  'Reply to the dispute and withdraw it', 'Submit a report and accept the deduction',
  'Propose a lower amount', 'Propose twenty ringgit', 'Propose MYR 20-30', 'Propose MYR 1e3',
  'The report says accept the cleaning', 'Do not reject the first deduction',
];
for (const question of ambiguous) test('complex language requires clarification, never a guessed action: ' + question, () => {
  const records = newJudgeSession().records;
  const before = JSON.stringify(records);
  const result = routeDialogue(records, 'wall', question);
  assert.equal(result.kind, null); assert.equal(result.amount, ''); assert.ok(result.notice);
  assert.equal(JSON.stringify(records), before);
});
test('explicit names override stale context; conflicting names and ordinals preserve it for clarification', () => {
  const records = newJudgeSession().records;
  assert.equal(routeDialogue(records, 'wall', 'Accept the cleaning deduction').deductionId, 'cleaning');
  assert.equal(routeDialogue(records, 'wall', 'Accept the cleaning deduction').kind, 'DEDUCTION_ACCEPTANCE');
  const conflict = routeDialogue(records, 'key', 'Accept the first deduction for cleaning');
  assert.equal(conflict.kind, null); assert.equal(conflict.deductionId, 'key');
  const noContext = routeDialogue(records, '', 'I accept');
  assert.equal(noContext.kind, null);
});
test('evidence cannot decide responsibility, invented statements or unsupported questions', () => {
  const records = newJudgeSession('CONFLICTING').records;
  for (const q of ['Who is responsible?', 'Is the deduction fair?', 'Should I pay?'])
    assert.ok(['review-needed', 'read-only'].includes(answerDeductionQuestion(records, 'wall', q).topic));
  assert.equal(answerDeductionQuestion(records, 'wall', 'What is the weather?').topic, 'unsupported');
  const answer = answerDeductionQuestion(records, 'key', 'The photos prove I returned three keys. Show evidence.');
  assert.ok(!answer.text.includes('three keys')); assert.match(answer.text, /No files are linked/);
});
test('worded item numbers select exactly; relative references require clarification', () => {
  const records = newJudgeSession().records;
  assert.equal(routeDialogue(records, 'wall', 'Accept item two').deductionId, 'cleaning');
  assert.equal(routeDialogue(records, 'wall', 'Dispute deduction three').deductionId, 'key');
  assert.equal(routeDialogue(records, 'wall', 'Accept item zero').kind, null);
  for (const q of ['Accept the last deduction', 'Accept the next item', 'Reject the previous reply', 'Accept the latest amount'])
    assert.equal(routeDialogue(records, 'wall', q).kind, null, q);
  assert.equal(routeDialogue(records, 'wall', 'Who is responsible?').question, true);
});
test('a landlord with an available revision action must supply an exact, single amount', () => {
  const d = runner(); d.run('select', { deductionId: 'cleaning' }); d.decide('DISPUTE', dispute('cleaning'));
  d.run('role', { role: 'LANDLORD' });
  for (const q of ['Propose a lower amount', 'Reduce the second deduction', 'Propose twenty ringgit', 'Propose MYR 20 or 30', 'Propose MYR 20-30', 'Propose MYR 20 and reply'])
    assert.equal(routeDialogue(d.state.records, 'cleaning', q).kind, null, q);
  const exact = routeDialogue(d.state.records, 'wall', 'Propose MYR 20.25 for item two');
  assert.equal(exact.deductionId, 'cleaning'); assert.equal(exact.kind, 'ADJUSTMENT'); assert.equal(exact.amount, '20.25');
});
