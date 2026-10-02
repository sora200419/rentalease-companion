import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const compiled = name => import(pathToFileURL(join(process.env.RENTALEASE_TEST_OUTPUT, 'companion', name + '.js')));
const { createMcpLimits, MCP_LIMITS } = await compiled('mcp-limits');
const { readMcpMessage } = await compiled('mcp-body');
const { handleRecordsMcp, RECORDS_ORIGIN } = await compiled('mcp-server');
const { callLocalMcpTool } = await compiled('mcp-connection');
const endpoint = RECORDS_ORIGIN + '/api/mcp';
const ping = { jsonrpc: '2.0', id: 1, method: 'ping' };
const headers = { Host: '127.0.0.1:3031', 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' };
const request = (body = JSON.stringify(ping), extra = {}, signal) => new Request(endpoint, {
  method: 'POST', headers: { ...headers, ...extra }, body, signal,
  ...(body instanceof ReadableStream ? { duplex: 'half' } : {}),
});
const services = limits => ({
  limits: limits ?? createMcpLimits(), authenticate: async () => 'tenant-one',
  list: async () => ({ role: 'TENANT', viewerId: 'private-user', tenancies: [] }),
  get: async () => { throw new Error('Unexpected record access.'); },
});
const deferred = () => {
  let resolve;
  const promise = new Promise(r => { resolve = r; });
  return { promise, resolve };
};

test('account request buckets refill gradually and never share one user quota with another', () => {
  let now = 1000;
  const limiter = createMcpLimits({ burst: 2, refillPerSecond: 1 }, () => now);
  for (let i = 0; i < 2; i++) { const access = limiter.enterAccount('a'); assert.equal(access.ok, true); access.release(); }
  assert.deepEqual(limiter.enterAccount('a'), { ok: false, status: 429, retryAfter: 1 });
  const other = limiter.enterAccount('b'); assert.equal(other.ok, true); other.release();
  now += 500; assert.equal(limiter.enterAccount('a').ok, false);
  now += 500; const refilled = limiter.enterAccount('a'); assert.equal(refilled.ok, true); refilled.release();
  now -= 500; assert.equal(limiter.enterAccount('a').ok, false); // A clock rollback cannot refill.
});

test('global and account concurrency leases release exactly once', () => {
  const limiter = createMcpLimits({ globalConcurrent: 1, accountConcurrent: 1 });
  const global = limiter.enterRequest(); const account = limiter.enterAccount('a');
  assert.equal(limiter.enterRequest().status, 503); assert.equal(limiter.enterAccount('a').status, 429);
  account.release(); account.release(); global.release(); global.release();
  const next = limiter.enterRequest(); assert.equal(next.ok, true);
  assert.equal(limiter.enterRequest().ok, false); next.release();
  const nextAccount = limiter.enterAccount('a'); assert.equal(nextAccount.ok, true);
  assert.equal(limiter.enterAccount('a').ok, false); nextAccount.release();
});

test('account table is bounded and active entries cannot be evicted', () => {
  let now = 0;
  const limiter = createMcpLimits({ maxAccounts: 1, idleMs: 1000, burst: 2, refillPerSecond: 1 }, () => now);
  const active = limiter.enterAccount('a'); now = 60000;
  assert.equal(limiter.enterAccount('b').status, 503);
  active.release(); const other = limiter.enterAccount('b'); assert.equal(other.ok, true); other.release();
});

test('idle eviction cannot reset a depleted bucket before it has refilled', () => {
  let now = 0;
  const limiter = createMcpLimits({ burst: 1, refillPerSecond: 0.1, idleMs: 1 }, () => now);
  limiter.enterAccount('a').release(); now = 1000;
  assert.equal(limiter.enterAccount('a').ok, false);
  now = 11000; const next = limiter.enterAccount('a'); assert.equal(next.ok, true); next.release();
  for (const invalid of [0, -1, Infinity, NaN]) assert.throws(() => createMcpLimits({ burst: invalid }));
});

test('rate-limited HTTP requests return Retry-After, do not cache and cannot be bypassed with spoofed identities', async () => {
  const api = services(createMcpLimits({ burst: 1 }, () => 0));
  assert.equal((await handleRecordsMcp(request(), api)).status, 200);
  const denied = await handleRecordsMcp(request(undefined, { 'X-Forwarded-For': '203.0.113.9', 'X-Actor-Id': 'landlord' }), api);
  assert.equal(denied.status, 429); assert.equal(denied.headers.get('retry-after'), '1');
  assert.equal(denied.headers.get('cache-control'), 'no-store');
  api.authenticate = async () => 'tenant-two';
  assert.equal((await handleRecordsMcp(request(), api)).status, 200);
});

test('global admission protects authentication and releases on both auth failure and exceptions', async () => {
  const api = services(createMcpLimits({ globalConcurrent: 1 }));
  const entered = deferred(), finish = deferred(); let checks = 0;
  api.authenticate = async () => { checks++; entered.resolve(); return finish.promise; };
  const first = handleRecordsMcp(request(), api); await entered.promise;
  const blocked = await handleRecordsMcp(request(), api);
  assert.equal(blocked.status, 503); assert.equal(checks, 1); assert.equal(blocked.headers.get('retry-after'), '1');
  finish.resolve(null); assert.equal((await first).status, 401);
  api.authenticate = async () => { throw new Error('private authentication details'); };
  const broken = await handleRecordsMcp(request(), api); assert.equal(broken.status, 503);
  assert.ok(!(await broken.text()).includes('private authentication'));
  api.authenticate = async () => 'tenant-one'; assert.equal((await handleRecordsMcp(request(), api)).status, 200);
});

test('per-account concurrency blocks a second tool operation before accessing records', async () => {
  const api = services(createMcpLimits({ accountConcurrent: 1 }));
  const entered = deferred(), finish = deferred(); let queries = 0;
  api.list = async () => { queries++; entered.resolve(); await finish.promise; return { role: 'TENANT', tenancies: [] }; };
  const tool = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'list_tenancies', arguments: {} } });
  const first = handleRecordsMcp(request(tool), api); await entered.promise;
  assert.equal((await handleRecordsMcp(request(tool), api)).status, 429); assert.equal(queries, 1);
  finish.resolve(); assert.equal((await first).status, 200);
  assert.equal((await handleRecordsMcp(request(), api)).status, 200);
});

test('invalid bodies release concurrency slots, and cloud bearer credentials are never accepted', async () => {
  const api = services(createMcpLimits({ globalConcurrent: 1, accountConcurrent: 1 }));
  for (const body of ['{', '[]']) assert.equal((await handleRecordsMcp(request(body), api)).status, 400);
  assert.equal((await handleRecordsMcp(request(), api)).status, 200);
  let authenticated = false; api.authenticate = async () => { authenticated = true; return 'tenant-one'; };
  const bearer = await handleRecordsMcp(request(undefined, { Authorization: 'Bearer synthetic-secret' }), api);
  assert.equal(bearer.status, 400); assert.equal(authenticated, false);
  assert.ok(!(await bearer.text()).includes('synthetic-secret'));
});

test('body parser rejects declared and streamed oversized payloads including multibyte text', async () => {
  await assert.rejects(readMcpMessage(request('{}', { 'Content-Length': String(MCP_LIMITS.bodyBytes + 1) })), e => e.status === 413);
  await assert.rejects(readMcpMessage(request('{}', { 'Content-Length': '-1' })), e => e.status === 400);
  // A forged small Content-Length does not bypass the real byte count.
  await assert.rejects(readMcpMessage(request(JSON.stringify('€'.repeat(8100)), { 'Content-Length': '2' })), e => e.status === 413);
  const stream = new ReadableStream({ start(c) { c.enqueue(new Uint8Array(12000)); c.enqueue(new Uint8Array(12001)); c.close(); } });
  await assert.rejects(readMcpMessage(request(stream)), e => e.status === 413);
});

test('body parser validates JSON encoding, content type and single-message protocol', async () => {
  assert.deepEqual(await readMcpMessage(request()), ping);
  await assert.rejects(readMcpMessage(request('{}', { 'Content-Type': 'text/plain' })), e => e.status === 415);
  await assert.rejects(readMcpMessage(request(new Uint8Array([0xff]))), e => e.status === 400 && e.rpcCode === -32700);
  await assert.rejects(readMcpMessage(request('[]')), e => e.status === 400 && e.rpcCode === -32600);
});

test('slow bodies time out even when stream cancellation never resolves', async () => {
  let cancelled = false;
  const stream = new ReadableStream({ cancel() { cancelled = true; return new Promise(() => {}); } });
  await assert.rejects(readMcpMessage(request(stream), 20), e => e.status === 408 && /timed out/.test(e.message));
  assert.equal(cancelled, true);
});

test('request abort interrupts a pending body and does not execute a tool', async () => {
  const controller = new AbortController();
  let cancelled = false;
  const stream = new ReadableStream({ cancel() { cancelled = true; } });
  const reading = readMcpMessage(request(stream, {}, controller.signal)); controller.abort();
  await assert.rejects(reading, e => e.status === 408); assert.equal(cancelled, true);
  const api = services(); let queries = 0; api.list = async () => { queries++; return {}; };
  const stopped = await handleRecordsMcp(request(undefined, {}, controller.signal), api);
  assert.equal(stopped.status, 408); assert.equal(queries, 0);
});

test('browser client succeeds through the real adapter and restricts redirects and cookies', async () => {
  const api = services(); let requests = 0;
  const result = await callLocalMcpTool('list_tenancies', {}, RECORDS_ORIGIN, { fetch: async (url, init) => {
    requests++; assert.equal(new URL(url).href, endpoint);
    assert.equal(init.credentials, 'same-origin'); assert.equal(init.redirect, 'error'); assert.equal(init.cache, 'no-store');
    assert.ok(init.signal);
    const actualHeaders = new Headers(init.headers); actualHeaders.set('host', '127.0.0.1:3031');
    return handleRecordsMcp(new Request(url, { ...init, headers: actualHeaders }), api);
  } });
  assert.equal(result.role, 'TENANT'); assert.deepEqual(result.tenancies, []);
  assert.ok(requests >= 3); assert.equal(result.viewerId, undefined);
});

test('browser errors are readable, hide raw responses and do not automatically retry', async () => {
  for (const [status, expected] of [[401, /sign in again/], [403, /not allowed/], [408, /too long/], [429, /Too many requests/], [503, /busy or temporarily unavailable/]]) {
    let requests = 0;
    await assert.rejects(callLocalMcpTool('list_tenancies', {}, RECORDS_ORIGIN, { fetch: async () => {
      requests++; return new Response('synthetic internal password', { status });
    } }), e => expected.test(e.message) && !e.message.includes('password'));
    assert.equal(requests, 1);
  }
});

test('browser deadline interrupts a stuck initialization with no tool call or automatic retry', async () => {
  let requests = 0, signal;
  await assert.rejects(callLocalMcpTool('list_tenancies', {}, RECORDS_ORIGIN, { timeoutMs: 20, fetch: async (_url, init) => {
    requests++; signal = init.signal;
    // Deliberately ignore cancellation to exercise the outer deadline too.
    return new Promise(() => {});
  } }), /too long.*Nothing was saved/);
  assert.equal(requests, 1); assert.equal(signal.aborted, true);
});

test('browser deadline also covers a stalled read-only tool after successful initialization', async () => {
  const api = services(); let toolCalls = 0; const finish = deferred();
  api.list = async () => { toolCalls++; await finish.promise; return { role: 'TENANT', tenancies: [] }; };
  try {
    await assert.rejects(callLocalMcpTool('list_tenancies', {}, RECORDS_ORIGIN, { timeoutMs: 250, fetch: async (url, init) => {
      const actualHeaders = new Headers(init.headers); actualHeaders.set('host', '127.0.0.1:3031');
      return handleRecordsMcp(new Request(url, { ...init, headers: actualHeaders }), api);
    } }), /too long.*Nothing was saved/);
    assert.equal(toolCalls, 1);
  } finally { finish.resolve(); }
});
