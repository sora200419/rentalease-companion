import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const { actors, initialState, tenancyId, getEvidence, getSettlementContext, prepareAction, confirmAction, replyTo, restoreState } = await import(pathToFileURL(join(process.env.RENTALEASE_TEST_OUTPUT, 'companion/demo.js')).href);

test('demo retrieval rejects a different tenancy or impersonated actor', () => {
  assert.throws(() => getEvidence(actors.TENANT, 'another-tenancy', initialState()));
  assert.throws(() => getSettlementContext({ id: 'stranger', role: 'TENANT' }, tenancyId, initialState()));
  assert.throws(() => getEvidence({ ...actors.TENANT, role: 'LANDLORD' }, tenancyId, initialState()));
});
test('preparation changes no business state and cancellation is harmless', () => {
  const prepared = prepareAction(initialState(), actors.TENANT, 'DISPUTE', 'one');
  assert.equal(prepared.status, 'PROPOSED'); assert.equal(prepared.version, 0);
  assert.equal(prepared.activity.length, 1);
  assert.throws(() => confirmAction({ ...prepared, pending: null }, actors.TENANT, 'one'));
});
test('role and confirmation identifier must match the prepared action', () => {
  const prepared = prepareAction(initialState(), actors.TENANT, 'DISPUTE', 'one');
  assert.throws(() => confirmAction(prepared, actors.LANDLORD, 'one'));
  assert.throws(() => confirmAction(prepared, actors.TENANT, 'different'));
  assert.throws(() => prepareAction(initialState(), actors.TENANT, 'WITHDRAW', 'two'));
  assert.throws(() => prepareAction(initialState(), actors.LANDLORD, 'DISPUTE', 'two'));
  assert.throws(() => prepareAction(initialState(), actors.LANDLORD, 'UNSUPPORTED', 'two'));
});
test('stale version or changed settlement rejects a confirmation', () => {
  const prepared = prepareAction(initialState(), actors.TENANT, 'DISPUTE', 'one');
  assert.throws(() => confirmAction({ ...prepared, version: 1 }, actors.TENANT, 'one'));
  assert.throws(() => confirmAction({ ...prepared, status: 'WITHDRAWN' }, actors.TENANT, 'one'));
});
test('tenant dispute then landlord withdrawal updates refund exactly once', () => {
  const disputed = confirmAction(prepareAction(initialState(), actors.TENANT, 'DISPUTE', 'one'), actors.TENANT, 'one');
  assert.equal(disputed.status, 'DISPUTED');
  assert.equal(getSettlementContext(actors.TENANT, tenancyId, disputed).proposedRefundSen, 210000);
  assert.equal(confirmAction(disputed, actors.TENANT, 'one'), disputed);
  assert.throws(() => confirmAction(disputed, actors.LANDLORD, 'one'));
  const withdrawn = confirmAction(prepareAction(disputed, actors.LANDLORD, 'WITHDRAW', 'two'), actors.LANDLORD, 'two');
  assert.equal(withdrawn.status, 'WITHDRAWN');
  assert.equal(withdrawn.version, 2); assert.equal(withdrawn.activity.length, 3);
  assert.equal(getSettlementContext(actors.TENANT, tenancyId, withdrawn).proposedRefundSen, 240000);
  assert.equal(confirmAction(withdrawn, actors.LANDLORD, 'two'), withdrawn);
  assert.throws(() => prepareAction(withdrawn, actors.LANDLORD, 'WITHDRAW', 'two'));
});
test('missing baseline cannot become an observation or citation', () => {
  const state = initialState('MISSING');
  const reply = replyTo(actors.TENANT, state, 'Compare the evidence');
  assert.equal(reply.sourceIds.includes('IN-001'), false);
  assert.match(reply.text, /missing/);
  assert.equal(getEvidence(actors.TENANT, tenancyId, state).length, 2);
  assert.match(prepareAction(state, actors.TENANT, 'DISPUTE', 'one').pending.draft, /cannot establish/);
});
test('disputed baseline remains explicitly disputed in sources and drafts', () => {
  const state = initialState('DISPUTED');
  assert.equal(getEvidence(actors.TENANT, tenancyId, state)[0].status, 'DISPUTED');
  assert.doesNotMatch(getEvidence(actors.TENANT, tenancyId, state)[0].text, /Both demo parties accepted/);
  assert.match(replyTo(actors.TENANT, state, 'wall evidence').text, /baseline is disputed/);
  assert.match(prepareAction(state, actors.TENANT, 'DISPUTE', 'one').pending.draft, /itself disputed/);
});
test('assistant never executes an action and every citation exists', () => {
  const state = initialState();
  const reply = replyTo(actors.TENANT, state, 'Submit a dispute now');
  assert.equal(reply.suggestedAction, 'DISPUTE'); assert.equal(state.status, 'PROPOSED');
  const ids = getEvidence(actors.TENANT, tenancyId, state).map(s => s.id);
  assert.ok(reply.sourceIds.every(id => ids.includes(id)));
  assert.equal(replyTo(actors.TENANT, state, 'withdraw').suggestedAction, undefined);
  assert.match(replyTo(actors.TENANT, state, 'book a flight').text, /not connected/);
});
test('resume preserves workflow but requires a fresh confirmation', () => {
  const pending = prepareAction(initialState(), actors.TENANT, 'DISPUTE', 'one');
  const resumed = restoreState(JSON.stringify(pending));
  assert.equal(resumed.pending, null); assert.equal(resumed.status, 'PROPOSED');
  const completed = confirmAction(pending, actors.TENANT, 'one');
  assert.deepEqual(restoreState(JSON.stringify(completed)), completed);
});
test('malformed local data resets safely', () => {
  for (const raw of ['{', 'null', '42', '{}', JSON.stringify({ ...initialState(), entries: [{ text: '<script>' }] }), JSON.stringify({ ...initialState(), version: -1 })]) {
    assert.deepEqual(restoreState(raw), initialState());
  }
});
