import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const output = process.env.RENTALEASE_TEST_OUTPUT;
const { SessionStore, parseCommand, snapshot } = await import(pathToFileURL(join(output, 'companion/service.js')).href);
const { generateReply, validateModelReply } = await import(pathToFileURL(join(output, 'companion/provider.js')).href);
const { actors, initialState } = await import(pathToFileURL(join(output, 'companion/demo.js')).href);
async function setup() {
  const directory = await mkdtemp(join(output, 'sessions-'));
  const store = new SessionStore(directory); const created = await store.create();
  return { directory, store, ...created };
}
function rejectsStatus(status) { return error => error.status === status; }

test('client cannot inject actor IDs, amounts, records or roles into a confirmation', () => {
  for (const field of ['actorId', 'depositSen', 'state', 'tenancyId', 'role']) {
    assert.throws(() => parseCommand('confirm', { revision: 0, actionId: 'a'.repeat(36), [field]: 'forged' }), rejectsStatus(400));
  }
  assert.throws(() => parseCommand('__proto__', { revision: 0 }), rejectsStatus(400));
  assert.throws(() => parseCommand('chat', { revision: 0, question: ' '.repeat(5) }), rejectsStatus(400));
  assert.throws(() => parseCommand('chat', { revision: 0, question: 'a'.repeat(1001) }), rejectsStatus(400));
});
test('sessions persist on disk and one session cannot confirm another session’s action', async () => {
  const { directory, store, id } = await setup();
  const second = await store.create();
  const prepared = await store.execute(id, { operation: 'prepare', revision: 0, kind: 'DISPUTE' }, {});
  const actionId = prepared.session.state.pending.id;
  await assert.rejects(store.execute(second.id, { operation: 'confirm', revision: 0, actionId }, {}), rejectsStatus(409));
  assert.equal((await new SessionStore(directory).read(id)).state.pending.id, actionId);
  assert.equal((await store.read(second.id)).state.pending, null);
  await assert.rejects(store.read('../outside'), rejectsStatus(401));
});
test('server confirmation is idempotent and ignores a retry’s stale revision', async () => {
  const { store, id } = await setup();
  const prepared = await store.execute(id, { operation: 'prepare', revision: 0, kind: 'DISPUTE' }, {});
  const command = { operation: 'confirm', revision: prepared.session.revision, actionId: prepared.session.state.pending.id };
  const first = await store.execute(id, command, {});
  const second = await store.execute(id, command, {});
  assert.equal(first.session.revision, second.session.revision);
  assert.equal(second.session.state.activity.length, 2);
});
test('simultaneous commands serialize and only one matching revision succeeds', async () => {
  const { store, id } = await setup();
  const results = await Promise.allSettled([
    store.execute(id, { operation: 'prepare', revision: 0, kind: 'DISPUTE' }, {}),
    store.execute(id, { operation: 'reset', revision: 0, baseline: 'MISSING' }, {}),
  ]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(results.find(r => r.status === 'rejected').reason.status, 409);
});
test('role switch cancels drafts and wrong-role prepare fails', async () => {
  const { store, id } = await setup();
  const prepared = await store.execute(id, { operation: 'prepare', revision: 0, kind: 'DISPUTE' }, {});
  const switched = await store.execute(id, { operation: 'role', revision: 1, role: 'LANDLORD' }, {});
  assert.equal(switched.session.state.pending, null);
  await assert.rejects(store.execute(id, { operation: 'confirm', revision: 2, actionId: prepared.session.state.pending.id }, {}), rejectsStatus(409));
  await assert.rejects(store.execute(id, { operation: 'prepare', revision: 2, kind: 'DISPUTE' }, {}), rejectsStatus(409));
});
test('expired confirmation and expired session are rejected', async () => {
  const { store, directory, id } = await setup();
  const prepared = await store.execute(id, { operation: 'prepare', revision: 0, kind: 'DISPUTE' }, {});
  const filename = join(directory, `${id}.json`);
  const data = JSON.parse(await readFile(filename, 'utf8')); data.pendingUntil = 1;
  await writeFile(filename, JSON.stringify(data));
  await assert.rejects(store.execute(id, { operation: 'confirm', revision: 1, actionId: prepared.session.state.pending.id }, {}), rejectsStatus(409));
  data.expiresAt = 1; await writeFile(filename, JSON.stringify(data));
  await assert.rejects(store.read(id), rejectsStatus(401));
});
test('resume discards an unconfirmed draft without changing settlement status', async () => {
  const { store, id } = await setup();
  await store.execute(id, { operation: 'prepare', revision: 0, kind: 'DISPUTE' }, {});
  const resumed = await store.resume(id);
  assert.equal(resumed.state.pending, null); assert.equal(resumed.state.status, 'PROPOSED');
  assert.equal(resumed.revision, 2);
});
test('server chat cannot execute financial actions and hides the other role’s conversations', async () => {
  const { store, id } = await setup();
  const chat = await store.execute(id, { operation: 'chat', revision: 0, question: 'submit a dispute now' }, {});
  assert.equal(chat.session.state.status, 'PROPOSED'); assert.equal(chat.session.state.pending, null);
  assert.equal(chat.session.state.entries.length, 2);
  const switched = await store.execute(id, { operation: 'role', revision: 1, role: 'LANDLORD' }, {});
  assert.equal(snapshot(switched.session).state.entries.length, 0);
});
test('rule mode makes zero model requests', async () => {
  const reply = await generateReply(actors.TENANT, initialState(), 'wall evidence', { fetcher: () => { throw new Error('Must not call fetch'); } });
  assert.equal(reply.provider, 'rules'); assert.equal(reply.notice, undefined);
});

test('critical money and action questions bypass the model with authoritative state', async () => {
  const config = { model: 'test:local', fetcher: () => { throw new Error('Must not call model'); } };
  for (const question of ['Withdraw and pay me now', 'What is my refund?', '请退还押金并确认付款']) {
    const state = { ...initialState(), status: 'DISPUTED' };
    const before = JSON.stringify(state);
    const reply = await generateReply(actors.LANDLORD, state, question, config);
    assert.equal(reply.provider, 'rules'); assert.equal(reply.notice, undefined);
    assert.match(reply.text, /2,100/); assert.match(reply.text, /Review withdrawal/);
    assert.equal(JSON.stringify(state), before);
  }
  const reply = await generateReply(actors.TENANT, { ...initialState(), status: 'WITHDRAWN' }, 'Refund status', config);
  assert.match(reply.text, /2,400/); assert.match(reply.text, /does not make payments/);
  assert.doesNotMatch(reply.text, /Confirm withdrawal/);
});

test('model amount unit errors fall back instead of displaying RM30000', async () => {
  const reply = await generateReply(actors.TENANT, initialState(), 'Explain wall evidence', {
    model: 'test:local', fetcher: async url => url.endsWith('/tags')
      ? Response.json({ models: [{ name: 'test:local', size: 1024, details: { format: 'gguf' } }] })
      : Response.json({ message: { content: JSON.stringify({ text: 'OUT-001 proposes RM30,000.', sourceIds: ['OUT-001'] }) } }),
  });
  assert.equal(reply.provider, 'rules'); assert.ok(reply.notice);
  assert.doesNotMatch(reply.text, /30,000/);
});

test('observed unsupported Chinese conclusion falls back to a localized evidence summary', async () => {
  const reply = await generateReply(actors.TENANT, initialState(), '入住记录能帮到我吗？', {
    model: 'test:local', fetcher: async url => url.endsWith('/tags')
      ? Response.json({ models: [{ name: 'test:local', size: 1024, details: { format: 'gguf' } }] })
      : Response.json({ message: { content: JSON.stringify({ text: '扣款依据不足。', sourceIds: [] }) } }),
  });
  assert.equal(reply.provider, 'rules'); assert.ok(reply.notice);
  assert.match(reply.text, /不能判定责任/); assert.doesNotMatch(reply.text, /扣款依据不足/);
});
test('model text and structured citations cannot reference unavailable sources', () => {
  assert.throws(() => validateModelReply({ text: 'IN-001 proves it', sourceIds: [] }, ['OUT-001']));
  assert.throws(() => validateModelReply({ text: 'Evidence', sourceIds: ['OUT-999'] }, ['OUT-001']));
  assert.throws(() => validateModelReply({ text: 'Evidence', sourceIds: [], action: 'PAY' }, ['OUT-001']));
  assert.deepEqual(validateModelReply({ text: 'OUT-001 awaits review.', sourceIds: ['OUT-001'] }, ['OUT-001']), { text: 'OUT-001 awaits review.', sourceIds: ['OUT-001'] });
});
test('local model receives server evidence and only its role’s conversation', async () => {
  const state = initialState('MISSING');
  state.entries.push({ id: 'hidden', role: 'LANDLORD', speaker: 'USER', text: 'PRIVATE_OTHER_ROLE', sourceIds: [] });
  const reply = await generateReply(actors.TENANT, state, 'Explain the evidence', { model: 'test:local', fetcher: async (url, options) => {
    assert.ok(url.startsWith('http://127.0.0.1:11434/'));
    assert.equal(options.redirect, 'error');
    if (url.endsWith('/tags')) return Response.json({ models: [{ name: 'test:local', size: 1024, details: { format: 'gguf' } }] });
    const request = JSON.parse(options.body);
    assert.equal(request.stream, false); assert.equal(request.format.type, 'object');
    assert.equal(request.think, false); assert.equal(request.options.num_ctx, 8192);
    assert.equal(request.messages.some(m => m.content.includes('PRIVATE_OTHER_ROLE')), false);
    assert.match(request.messages[0].content, /"baseline":"MISSING"/);
    return Response.json({ message: { content: JSON.stringify({ text: 'OUT-001 awaits review. The move-in report is missing.', sourceIds: ['OUT-001'] }) } });
  } });
  assert.equal(reply.provider, 'ollama');
});
test('missing, cloud, timeout and malformed model replies fall back visibly', async () => {
  const fetchers = [
    async () => { throw new Error('Timed out'); },
    async () => Response.json({ models: [] }),
    async url => url.endsWith('/tags') ? Response.json({ models: [{ name: 'test:local', remote_host: 'https://cloud.example' }] }) : Response.json({}),
    async url => url.endsWith('/tags') ? Response.json({ models: [{ name: 'test:local', size: 1024, details: { format: 'gguf' } }] }) : Response.json({ message: { content: 'not json' } }),
    async url => url.endsWith('/tags') ? Response.json({ models: [{ name: 'test:local', size: 1024, details: { format: 'gguf' } }] }) : Response.json({ message: { content: JSON.stringify({ text: 'IN-001 says it', sourceIds: ['IN-001'] }) } }),
  ];
  for (const fetcher of fetchers) {
    const reply = await generateReply(actors.TENANT, initialState('MISSING'), 'wall evidence', { model: 'test:local', fetcher });
    assert.equal(reply.provider, 'rules'); assert.ok(reply.notice); assert.equal(reply.sourceIds.includes('IN-001'), false);
  }
  const cloud = await generateReply(actors.TENANT, initialState(), 'wall evidence', { model: 'test:cloud', fetcher: () => { throw new Error('must not fetch'); } });
  assert.equal(cloud.provider, 'rules'); assert.ok(cloud.notice);
});
