import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
const get = file => import(pathToFileURL(join(process.env.RENTALEASE_TEST_OUTPUT, 'companion', file + '.js')));
const { JudgeStore } = await get('judge-store');
const { judgeSnapshot } = await get('judge-demo');
const { handleRecordsMcp } = await get('mcp-server');
const { createMcpLimits } = await get('mcp-limits');
const { DEMO_HTTP, DEMO_MCP_URL, JUDGE_PROFILE, judgeMcpServices } = await get('judge-mcp');

async function withStore(work) {
  const directory = await mkdtemp(join(tmpdir(), 'rentalease-judge-mcp-'));
  try { await work(new JudgeStore(directory), directory); } finally { await rm(directory, { recursive: true, force: true }); }
}
function endpoint(store) {
  const services = { ...judgeMcpServices(store), profile: JUDGE_PROFILE, limits: createMcpLimits() };
  const send = (init = {}) => handleRecordsMcp(new Request(DEMO_MCP_URL, {
    method: 'POST', body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }),
    ...init, headers: { Host: '127.0.0.1:3030', Accept: 'application/json, text/event-stream', 'Content-Type': 'application/json',
      'MCP-Protocol-Version': '2025-11-25', ...init.headers },
  }), services, DEMO_HTTP);
  // Native clients (Inspector CLI, mcp-remote) send no Origin header; neither does this transport.
  const connect = async token => {
    const client = new Client({ name: 'judge-mcp-test', version: '1.0.0' });
    await client.connect(new StreamableHTTPClientTransport(new URL(DEMO_MCP_URL), {
      requestInit: { headers: { Authorization: 'Bearer ' + token } },
      fetch: async (url, options) => {
        const headers = new Headers(options?.headers); headers.set('host', '127.0.0.1:3030');
        return handleRecordsMcp(new Request(url, { ...options, headers }), services, DEMO_HTTP);
      },
    }));
    return client;
  };
  return { send, connect };
}
const tenancyId = 'judge-synthetic-tenancy';

test('per-role MCP tokens are stable, resolvable and never part of a snapshot', () => withStore(async store => {
  const { id } = await store.create();
  const tokens = await store.mcpConnection(id);
  assert.match(tokens.TENANT, /^rle_demo_[A-Za-z0-9_-]{43}$/); assert.notEqual(tokens.TENANT, tokens.LANDLORD);
  assert.deepEqual(await store.mcpConnection(id), tokens, 'tokens are issued once per case');
  assert.deepEqual(await store.resolveMcpToken(tokens.TENANT), { id, role: 'TENANT' });
  assert.deepEqual(await store.resolveMcpToken(tokens.LANDLORD), { id, role: 'LANDLORD' });
  for (const bad of ['', 'rle_demo_short', tokens.TENANT.slice(0, -1) + (tokens.TENANT.endsWith('A') ? 'B' : 'A'), id])
    assert.equal(await store.resolveMcpToken(bad), null, bad);
  const snapshot = judgeSnapshot(await store.read(id));
  assert.equal('mcp' in snapshot, false);
  assert.ok(!JSON.stringify(snapshot).includes(tokens.TENANT));
}));

test('a new scenario carries the tokens to the new case and the old case stops answering', () => withStore(async store => {
  const first = await store.create();
  const tokens = await store.mcpConnection(first.id);
  const second = await store.create('MISSING', first.id);
  assert.deepEqual(await store.resolveMcpToken(tokens.TENANT), { id: second.id, role: 'TENANT' });
  assert.equal((await store.read(first.id)).mcp, undefined, 'previous case no longer holds the tokens');
  assert.equal((await store.read(first.id)).records.tenancyId, tenancyId, 'previous history is retained');
  const fresh = await store.create('STANDARD', 'not-a-session');
  assert.equal(fresh.session.mcp, undefined, 'invalid previous ids are ignored');
}));

test('expired cases revoke their tokens', () => withStore(async store => {
  const { id } = await store.create();
  const tokens = await store.mcpConnection(id);
  await store.mutate(id, session => ({ ...session, expiresAt: Date.now() - 1 }));
  assert.equal(await store.resolveMcpToken(tokens.TENANT), null);
}));

test('demo endpoint requires a bearer token, the loopback host and a same-origin or absent Origin', () => withStore(async store => {
  const { id } = await store.create();
  const { TENANT } = await store.mcpConnection(id);
  const h = endpoint(store);
  const missing = await h.send();
  assert.equal(missing.status, 401); assert.match(missing.headers.get('www-authenticate') ?? '', /^Bearer /);
  assert.equal((await h.send({ headers: { Authorization: 'Bearer rle_demo_' + 'x'.repeat(43) } })).status, 401);
  assert.equal((await h.send({ headers: { Authorization: 'Basic abc' } })).status, 401);
  assert.equal((await h.send({ headers: { Authorization: 'Bearer ' + TENANT, Host: 'evil.example:3030' } })).status, 403);
  assert.equal((await h.send({ headers: { Authorization: 'Bearer ' + TENANT, Origin: 'https://evil.example' } })).status, 403);
  assert.equal((await h.send({ headers: { Authorization: 'Bearer ' + TENANT, Origin: 'http://127.0.0.1:3030' } })).status, 200);
  const listed = await (await h.send({ headers: { Authorization: 'Bearer ' + TENANT } })).json();
  assert.deepEqual(listed.result.tools.map(t => t.name).sort(),
    ['ask_records', 'get_agreement', 'get_deduction_evidence', 'get_settlement_context', 'list_tenancies', 'prepare_dispute_action']);
}));

test('a standard MCP client reads the live synthetic case and previews drafts as the token role only', () => withStore(async store => {
  const { id } = await store.create();
  const tokens = await store.mcpConnection(id);
  const h = endpoint(store);
  const tenant = await h.connect(tokens.TENANT);
  try {
    assert.match(tenant.getInstructions() ?? '', /Confirm and save/);
    const schema = (await tenant.listTools()).tools.find(t => t.name === 'prepare_dispute_action').inputSchema;
    const kinds = schema.properties.action.oneOf.map(branch => branch.properties.kind.const);
    assert.ok(!kinds.includes('REPORT') && kinds.includes('DISPUTE'), 'the demo exposes deduction decisions only');
    const listed = (await tenant.callTool({ name: 'list_tenancies', arguments: {} })).structuredContent;
    assert.equal(listed.role, 'TENANT'); assert.equal(listed.tenancies[0].id, tenancyId);
    const context = (await tenant.callTool({ name: 'get_settlement_context', arguments: { tenancyId } })).structuredContent;
    assert.equal(context.revision, 0); assert.equal(context.refundSen, 162500); assert.equal('reportAction' in context, false);
    const evidence = (await tenant.callTool({ name: 'ask_records', arguments: { tenancyId, deductionId: 'wall', question: 'Was the scuff already there when I moved in?' } })).structuredContent;
    assert.match(evidence.answer.text, /short scuff was recorded below the bedroom window/);
    assert.ok(evidence.answer.sourceIds.includes('move-in'));
    const before = structuredClone((await store.read(id)).records);
    const draft = await tenant.callTool({ name: 'prepare_dispute_action', arguments: { tenancyId, expectedRevision: 0,
      action: { kind: 'DISPUTE', payload: { deductionId: 'wall', text: 'The move-in report already records this scuff.' } } } });
    assert.equal(draft.isError, undefined); assert.equal(draft.structuredContent.saved, false);
    assert.match(draft.structuredContent.confirmation, /Confirm and save/);
    const report = await tenant.callTool({ name: 'prepare_dispute_action', arguments: { tenancyId, expectedRevision: 0,
      action: { kind: 'REPORT', payload: { reportType: 'INSPECTION', text: 'A new synthetic report draft.' } } } });
    assert.equal(report.isError, true);
    const landlordOnly = await tenant.callTool({ name: 'prepare_dispute_action', arguments: { tenancyId, expectedRevision: 0,
      action: { kind: 'WITHDRAWAL', payload: { deductionId: 'wall', text: 'Withdraw this synthetic deduction.' } } } });
    assert.equal(landlordOnly.isError, true, 'a tenant token cannot preview landlord decisions');
    assert.deepEqual((await store.read(id)).records, before, 'previews never change the case');
    const foreign = await tenant.callTool({ name: 'get_settlement_context', arguments: { tenancyId: 'fixture-b-tenancy' } });
    assert.equal(foreign.isError, true);
  } finally { await tenant.close(); }
  // The browser's role switch does not change what a token may do.
  await store.execute(id, 'role', { revision: 0, role: 'LANDLORD' });
  const again = await h.connect(tokens.TENANT);
  try { assert.equal((await again.callTool({ name: 'list_tenancies', arguments: {} })).structuredContent.role, 'TENANT'); }
  finally { await again.close(); }
  const landlord = await h.connect(tokens.LANDLORD);
  try {
    // Switching roles is a UI change; the business record revision is still 0.
    const withdrawal = await landlord.callTool({ name: 'prepare_dispute_action', arguments: { tenancyId, expectedRevision: 0,
      action: { kind: 'WITHDRAWAL', payload: { deductionId: 'wall', text: 'Withdraw this synthetic deduction.' } } } });
    assert.equal(withdrawal.structuredContent.refundIfAppliedSen, 172500);
  } finally { await landlord.close(); }
}));

test('MCP reads reflect decisions confirmed in the browser', () => withStore(async store => {
  const { id } = await store.create();
  const { TENANT } = await store.mcpConnection(id);
  await store.execute(id, 'prepare', { revision: 0, action: { kind: 'DISPUTE', payload: { deductionId: 'wall', text: 'The scuff was recorded at move-in.' } } });
  const pending = (await store.read(id)).pending;
  await store.execute(id, 'confirm', { revision: 1, id: pending.id });
  const client = await endpoint(store).connect(TENANT);
  try {
    const context = (await client.callTool({ name: 'get_settlement_context', arguments: { tenancyId } })).structuredContent;
    assert.equal(context.settlementStatus, 'DISPUTED');
    assert.equal(context.revision, 1);
  } finally { await client.close(); }
  assert.ok((await readdir(join(store['directory'], 'mcp-tokens'))).every(name => /^[a-f0-9]{64}\.json$/.test(name)), 'token index files are named by hash');
}));
