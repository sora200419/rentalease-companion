import assert from 'node:assert/strict';

// Run against the dedicated local demo server. Creates synthetic test sessions only.
const base = 'http://127.0.0.1:3030';
async function session() {
  const response = await fetch(`${base}/api/companion/session`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('set-cookie'), /HttpOnly/i);
  assert.match(response.headers.get('set-cookie'), /SameSite=strict/i);
  return { cookie: response.headers.get('set-cookie').split(';')[0], value: await response.json() };
}
async function command(cookie, operation, payload, status = 200, origin = base) {
  const response = await fetch(`${base}/api/companion/${operation}`, { method: 'POST', headers: { Cookie: cookie, Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  const body = await response.json();
  assert.equal(response.status, status, JSON.stringify(body)); return body;
}
const first = await session(); const second = await session();
await command(first.cookie, 'prepare', { revision: 0, kind: 'DISPUTE' }, 403, 'https://unrelated.example');
await command('', 'prepare', { revision: 0, kind: 'DISPUTE' }, 401);
await command(first.cookie, 'prepare', { revision: 0, kind: 'DISPUTE', actorId: 'demo-landlord' }, 400);
await command(first.cookie, 'chat', { revision: 0, question: 'a'.repeat(9000) }, 413);
const prepared = await command(first.cookie, 'prepare', { revision: 0, kind: 'DISPUTE' });
assert.equal(prepared.state.status, 'PROPOSED');
await command(second.cookie, 'confirm', { revision: 0, actionId: prepared.state.pending.id }, 409);
const disputed = await command(first.cookie, 'confirm', { revision: prepared.revision, actionId: prepared.state.pending.id });
assert.equal(disputed.state.status, 'DISPUTED');
const retried = await command(first.cookie, 'confirm', { revision: prepared.revision, actionId: prepared.state.pending.id });
assert.equal(retried.revision, disputed.revision);
await command(first.cookie, 'role', { revision: 0, role: 'LANDLORD' }, 409);
const landlord = await command(first.cookie, 'role', { revision: disputed.revision, role: 'LANDLORD' });
const withdrawal = await command(first.cookie, 'prepare', { revision: landlord.revision, kind: 'WITHDRAW' });
const withdrawn = await command(first.cookie, 'confirm', { revision: withdrawal.revision, actionId: withdrawal.state.pending.id });
assert.equal(withdrawn.settlement.proposedRefundSen, 240000);
assert.equal(withdrawn.state.status, 'WITHDRAWN');
const chat = await command(second.cookie, 'chat', { revision: 0, question: 'Compare the wall evidence' });
const reply = chat.state.entries.at(-1);
assert.ok(['rules', 'ollama'].includes(reply.provider));
assert.ok(reply.sourceIds.length > 0);
assert.ok(reply.sourceIds.every(id => ['IN-001', 'OUT-001', 'AGR-7'].includes(id)));
assert.equal(chat.state.status, 'PROPOSED');
assert.equal(chat.state.pending, null);
if (process.env.COMPANION_REQUIRE_AI === '1') assert.equal(reply.provider, 'ollama');
for (const path of ['/api/auth/session', '/api/deposit-refund', '/dashboard/tenant']) {
  assert.equal((await fetch(`${base}${path}`, { redirect: 'manual' })).status, 503);
}
console.log(`PASS: session isolation, origin/body validation, stale/repeated confirmations, full settlement, ${reply.provider} chat, inherited API block.`);
