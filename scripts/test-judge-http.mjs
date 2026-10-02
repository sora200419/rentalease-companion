// This integration check creates only isolated synthetic local sessions.
// It never reads environment files, connects to Supabase, or deletes history.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
const base = 'http://127.0.0.1:3030';
let cookie = '', state;
async function call(op, body, expected = 200, overrides = {}) {
  const response = await fetch(base + '/api/judge/' + op, {
    method: body === undefined ? 'GET' : 'POST', redirect: 'error',
    headers: { ...(cookie ? { cookie } : {}), ...(body === undefined ? {} : { origin: base, 'content-type': 'application/json' }), ...overrides },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(30000),
  });
  assert.equal(response.status, expected, op + ': unexpected HTTP status');
  if (response.headers.has('set-cookie')) {
    const header = response.headers.get('set-cookie');
    assert.match(header, /HttpOnly/i); assert.match(header, /SameSite=strict/i); assert.match(header, /Path=\/api\/judge/i);
    cookie = header.split(';')[0];
  }
  assert.equal(response.headers.get('cache-control'), 'no-store');
  if (response.headers.get('content-type')?.startsWith('image/png')) return new Uint8Array(await response.arrayBuffer());
  return response.json();
}
const command = async (op, input = {}) => state = await call(op, { revision: state.revision, ...input });
const decide = async (kind, payload) => {
  const original = structuredClone(state.records);
  await command('prepare', { action: { kind, payload } });
  assert.deepEqual(state.records, original);
  const id = state.pending.id;
  await command('confirm', { id });
  const saved = structuredClone(state);
  await command('confirm', { id });
  assert.deepEqual(state, saved, 'confirmation retry must not duplicate any event');
};
const dispute = deductionId => ({ deductionId, text: 'Please review this synthetic deduction.' });
const page = await fetch(base + '/demo', { signal: AbortSignal.timeout(60000) });
assert.equal(page.status, 200); assert.match(await page.text(), /A clearer end/);
state = await call('start', { scenario: 'STANDARD', confirmed: true });
const originalCookie = cookie;
assert.equal(state.photos.length, 4);
for (const [id, file] of Object.entries({ W01: 'wall-move-in-W01', W02: 'wall-move-out-W02', K01: 'kitchen-move-in-K01', K02: 'kitchen-move-out-K02' })) {
  const bytes = await call('photo?id=' + id);
  assert.deepEqual(bytes, new Uint8Array(await readFile(join('demo-assets', 'evidence', 'demo-' + file + '.png'))));
}
await call('photo?id=../README.md', undefined, 404);
await call('chat', { revision: state.revision, question: 'hello' }, 403, { origin: 'https://untrusted.example' });
await call('session', undefined, 400, { authorization: 'Bearer not-a-real-credential' });
const apiBlocked = await fetch(base + '/api/records');
assert.equal(apiBlocked.status, 503);
const originalRecords = structuredClone(state.records);
await command('chat', { question: 'Accept the second deduction and dispute the first' });
assert.equal(state.pending, null); assert.equal(state.selected, 'wall'); assert.deepEqual(state.records, originalRecords);
assert.match(state.messages.at(-1).text, /one deduction/);
await command('prepare', { action: { kind: 'DISPUTE', payload: dispute('wall') } });
const cancelledId = state.pending.id;
await command('cancel'); assert.deepEqual(state.records, originalRecords);
await call('confirm', { revision: state.revision, id: cancelledId }, 409);
await command('prepare', { action: { kind: 'DISPUTE', payload: dispute('wall') } });
const refreshedId = state.pending.id;
await command('resume'); assert.equal(state.pending, null);
await call('confirm', { revision: state.revision, id: refreshedId }, 409);
await decide('DISPUTE', dispute('wall'));
await command('select', { deductionId: 'cleaning' }); await decide('DISPUTE', dispute('cleaning'));
await command('role', { role: 'LANDLORD' });
assert.equal(state.messages.length, 0, 'role-specific conversations');
const disputeId = state.records.history.find(e => e.kind === 'DISPUTE' && e.payload.deductionId === 'cleaning').id;
await decide('RESPONSE', { disputeId, text: 'Please compare the synthetic cleaning reports.' });
const responseId = state.records.history.at(-1).id;
await command('role', { role: 'TENANT' });
await decide('REJECTION', { responseId, text: 'Please reconsider the stated cleaning amount.' });
await command('role', { role: 'LANDLORD' });
await decide('ADJUSTMENT', { deductionId: 'cleaning', text: 'Offer a revised synthetic amount.', amountSen: 2000 });
const adjustmentId = state.records.history.at(-1).id;
assert.equal(state.records.settlement.recordedRefundSen, 162500);
await command('role', { role: 'TENANT' });
await decide('ADJUSTMENT_ACCEPTANCE', { adjustmentId, text: 'I accept this proposed deduction amount.' });
await command('select', { deductionId: 'key' });
await decide('DEDUCTION_ACCEPTANCE', { deductionId: 'key', text: 'I accept this recorded deduction.' });
await command('select', { deductionId: 'wall' }); await command('role', { role: 'LANDLORD' });
await decide('WITHDRAWAL', { deductionId: 'wall', text: 'Withdraw this synthetic wall deduction.' });
assert.equal(state.records.settlement.status, 'AGREED');
assert.equal(state.records.settlement.recordedRefundSen, 175500);
assert.equal(state.records.settlement.paymentRecorded, false);
const retained = structuredClone(state.records);
state = await call('session'); assert.deepEqual(state.records, retained);
state = await call('start', { scenario: 'MISSING', confirmed: true });
assert.equal(state.photos.length, 2); await call('photo?id=W01', undefined, 404);
await command('chat', { question: 'Compare the wall evidence' });
assert.match(state.messages.at(-1).text, /No published move-in/);
assert.ok(!state.messages.at(-1).sourceIds.includes('move-in'));
state = await call('start', { scenario: 'CONFLICTING', confirmed: true });
await command('chat', { question: 'Compare the cleaning evidence' });
assert.match(state.messages.at(-1).text, /both keys were returned/);
assert.match(state.messages.at(-1).text, /no conflict has been resolved/);
cookie = originalCookie; state = await call('session');
assert.deepEqual(state.records, retained, 'new scenarios must preserve old history');
console.log('PASS: standalone HTTP workflow, isolation, confirmation/cancel/resume, source citations, four exact photo files, missing/conflicting evidence. No cloud credentials used.');
