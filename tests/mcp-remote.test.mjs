import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
const compiled = file => pathToFileURL(join(process.env.RENTALEASE_TEST_OUTPUT, 'companion', file));
const { createMcpAuthorizer, MCP_READ_SCOPE: read, MCP_PREVIEW_SCOPE: preview } = await import(compiled('mcp-authorization.js'));
const { createRemoteMcpHandler } = await import(compiled('mcp-remote.js'));
const { createMcpLimits } = await import(compiled('mcp-limits.js'));
const now = 1801100000;
const policy = { issuer: 'https://identity.example.test/oauth', resource: 'https://records.example.test/mcp',
  clientIds: ['synthetic-client'], algorithms: ['ES256', 'RS256'] };
const ec = await generateKeyPair('ES256');
const other = await generateKeyPair('ES256');
const rsa = await generateKeyPair('RS256');
const publicKeys = await Promise.all([ec, rsa].map(async (pair, i) => ({ ...await exportJWK(pair.publicKey), kid: `key-${i}`, alg: i ? 'RS256' : 'ES256' })));
const keySet = createLocalJWKSet({ keys: publicKeys });
const claims = { iss: policy.issuer, sub: 'synthetic-subject', aud: policy.resource, iat: now - 10,
  exp: now + 600, jti: 'synthetic-token', client_id: 'synthetic-client', scope: `${read} ${preview}` };
async function signed(changes = {}, header = {}, key = ec.privateKey) {
  return new SignJWT({ ...claims, ...changes }).setProtectedHeader({ typ: 'at+jwt', alg: 'ES256', kid: 'key-0', ...header }).sign(key);
}
const rpc = (method, params = {}) => ({ jsonrpc: '2.0', id: 1, method, params });
const records = { tenancyId: 'fixture-a-tenancy', role: 'TENANT', revision: 1, depositSen: 100000,
  settlement: { id: 'settlement', status: 'IN_REVIEW', recordedOriginalSen: 100000, recordedRefundSen: 95000, paymentRecorded: false,
    deductions: [{ id: 'cleaning', reason: 'Synthetic cleaning', status: 'PROPOSED', amountSen: 5000 }] },
  evidence: [], agreement: null, history: [] };
const report = { kind: 'REPORT', payload: { reportType: 'INSPECTION', text: 'Synthetic report preview only.' } };
function harness(extra = {}) {
  let grant = { issuer: policy.issuer, subject: claims.sub, clientId: claims.client_id, resource: policy.resource,
    accountId: 'linked-account', accountStatus: 'ACTIVE', revoked: false, validAfter: 0, expiresAt: now + 900, scopes: [read, preview] };
  let revoked = false, failLookup = false, lookupCount = 0, dataCalls = 0;
  const authenticate = createMcpAuthorizer(policy, {
    resolveKey: keySet,
    findGrant: async identity => { lookupCount++; assert.deepEqual(identity, { issuer: policy.issuer, resource: policy.resource, subject: claims.sub, clientId: claims.client_id });
      if (failLookup) throw new Error('private connection string must not be shown'); return grant; },
    isTokenRevoked: async identity => { assert.equal(identity.tokenId, claims.jti); return revoked; },
  }, () => now * 1000);
  const services = {
    list: async actor => { dataCalls++; assert.equal(actor, 'linked-account'); return { role: 'TENANT', viewerId: actor,
      tenancies: [{ id: records.tenancyId, status: 'ACTIVE', room: { label: 'Synthetic room' } }] }; },
    get: async (actor, tenancy) => { dataCalls++; assert.equal(actor, 'linked-account');
      if (tenancy !== records.tenancyId) throw new Error('Tenancy unavailable.'); return structuredClone(records); },
  };
  const handler = createRemoteMcpHandler({ policy, authenticate, services, enabled: true, ...extra });
  const request = (token, message = rpc('tools/list'), changes = {}) => new Request(changes.url ?? policy.resource, {
    method: changes.method ?? 'POST',
    headers: { host: new URL(policy.resource).host, accept: 'application/json, text/event-stream', 'content-type': 'application/json',
      'mcp-protocol-version': '2025-11-25', ...(token ? { authorization: `Bearer ${token}` } : {}), ...changes.headers },
    ...((changes.method ?? 'POST') === 'POST' ? { body: typeof message === 'string' ? message : JSON.stringify(message) } : {}),
  });
  return { handler, authenticate, request, send: (token, message, changes) => handler(request(token, message, changes)),
    setGrant: change => { grant = change === null ? null : { ...grant, ...change }; }, revoke: () => { revoked = true; },
    fail: () => { failLookup = true; }, lookups: () => lookupCount, dataCalls: () => dataCalls };
}

test('remote adapter stays disabled by default and makes no identity or record calls', async () => {
  for (const enabled of [undefined, false]) {
    const h = harness({ enabled });
    assert.equal((await h.send(undefined)).status, 404);
    assert.equal((await h.send(undefined, undefined, { url: 'https://records.example.test/.well-known/oauth-protected-resource/mcp', method: 'GET' })).status, 404);
    assert.equal(h.lookups(), 0); assert.equal(h.dataCalls(), 0);
  }
});

test('resource metadata and missing-token challenge point to the configured issuer, never request headers', async () => {
  const h = harness();
  const metadataUrl = 'https://records.example.test/.well-known/oauth-protected-resource/mcp';
  const response = await h.send(undefined, undefined, { url: metadataUrl, method: 'GET' });
  assert.deepEqual(await response.json(), { resource: policy.resource, authorization_servers: [policy.issuer], scopes_supported: [read, preview], bearer_methods_supported: ['header'] });
  const denied = await h.send(undefined, undefined, { headers: { 'x-forwarded-host': 'attacker.test' } });
  assert.equal(denied.status, 401); assert.equal(denied.headers.get('cache-control'), 'no-store');
  assert.ok(denied.headers.get('www-authenticate').includes(`resource_metadata="${metadataUrl}"`));
  assert.ok(!denied.headers.get('www-authenticate').includes('attacker'));
  assert.equal(h.lookups(), 0); assert.equal(h.dataCalls(), 0);
});

test('real asymmetric signatures map only a verified subject/client/resource grant to an account', async () => {
  for (const [header, key] of [[{}, ec.privateKey], [{ alg: 'RS256', kid: 'key-1' }, rsa.privateKey]]) {
    const h = harness(); const token = await signed({ actorId: 'other-account', role: 'LANDLORD', email: 'ignored@example.test' }, header, key);
    const principal = await h.authenticate(h.request(token));
    assert.deepEqual(principal, { actorId: 'linked-account', scopes: [read, preview] });
    assert.ok(Object.isFrozen(principal)); assert.ok(Object.isFrozen(principal.scopes));
    assert.equal((await h.send(token, rpc('tools/call', { name: 'list_tenancies', arguments: {} }))).status, 200);
    assert.equal(h.dataCalls(), 1);
  }
});

const invalidClaims = [
  ['issuer', { iss: 'https://other.example.test/oauth' }], ['audience', { aud: 'https://supabase.example.test/' }],
  ['multiple audiences', { aud: [policy.resource, 'other'] }], ['expiration', { exp: now - 30 }],
  ['not yet valid', { nbf: now + 60 }], ['future issued time', { iat: now + 60 }], ['old issued time', { iat: now - 4000 }],
  ['missing expiration', { exp: undefined }], ['missing issued time', { iat: undefined }], ['missing subject', { sub: undefined }],
  ['empty subject', { sub: '' }], ['unknown client', { client_id: 'unapproved-client' }], ['missing token ID', { jti: undefined }],
  ['excess lifetime', { exp: now + 5000 }], ['fractional times', { iat: now - 1.5 }],
  ['invalid scope type', { scope: [read, preview] }], ['missing scope', { scope: undefined }], ['scope control characters', { scope: `${read}\n${preview}` }],
];
test('expired, foreign, incomplete and malformed access-token claims fail before account lookup', async () => {
  for (const [label, changes] of invalidClaims) {
    const h = harness(); const response = await h.send(await signed(changes));
    assert.equal(response.status, 401, label);
    assert.match(response.headers.get('www-authenticate'), /invalid_token/);
    assert.equal(h.lookups(), 0, label); assert.equal(h.dataCalls(), 0, label);
  }
});

test('bad signatures, ID tokens, symmetric/unsigned tokens and token-directed keys are refused', async () => {
  const bad = [await signed({}, {}, other.privateKey), await signed({}, { typ: 'JWT' }),
    await signed({}, { kid: 'unknown-key' }), await signed({}, { jku: 'https://attacker.test/jwks' }),
    await signed({}, { x5u: 'https://attacker.test/cert' }), await signed({}, { jwk: publicKeys[0] }),
    await signed({}, { alg: 'HS256' }, new TextEncoder().encode('synthetic-test-secret-not-a-production-key')),
    Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64url') + '.' + Buffer.from(JSON.stringify(claims)).toString('base64url') + '.',
    'not-a-token', 'a'.repeat(8300) + '.b.c'];
  for (const token of bad) {
    const h = harness(); const response = await h.send(token);
    assert.equal(response.status, 401); assert.equal(h.lookups(), 0); assert.equal(h.dataCalls(), 0);
    assert.ok(!(await response.text()).includes(token));
  }
});

test('unlinked, disabled, stale and revoked grants fail closed without email-based auto-linking', async () => {
  const token = await signed({ email: 'same-email@example.test', role: 'LANDLORD' });
  for (const change of [null, { accountStatus: 'SUSPENDED' }, { accountStatus: 'DELETED' }, { revoked: true },
    { issuer: 'https://other.example.test/oauth' }, { subject: 'other-subject' }, { clientId: 'other-client' },
    { resource: 'https://other.example.test/mcp' }, { validAfter: now }, { validAfter: claims.iat }, { expiresAt: now }, { accountId: '' }, { scopes: null }]) {
    const h = harness(); h.setGrant(change);
    assert.equal((await h.send(token)).status, 403); assert.equal(h.dataCalls(), 0);
  }
});

test('read scope is required in both the token and current consent; preview-only cannot read', async () => {
  for (const scopes of [preview, 'unrelated:scope']) {
    const h = harness(); const response = await h.send(await signed({ scope: scopes }));
    assert.equal(response.status, 403); assert.match(response.headers.get('www-authenticate'), /insufficient_scope/);
  }
  const h = harness(); h.setGrant({ scopes: [preview] });
  assert.equal((await h.send(await signed())).status, 403); assert.equal(h.dataCalls(), 0);
});

test('token and consent scopes intersect; read-only discovery hides previews and crafted calls are denied', async () => {
  for (const restrictToken of [true, false]) {
    const h = harness(); if (!restrictToken) h.setGrant({ scopes: [read] });
    const token = await signed({ scope: restrictToken ? `${read} arbitrary:write` : `${read} ${preview}` });
    const discovery = await (await h.send(token)).json();
    assert.equal(discovery.result.tools.length, 5); assert.ok(!discovery.result.tools.some(t => t.name === 'prepare_dispute_action'));
    const denied = await h.send(token, rpc('tools/call', { name: 'prepare_dispute_action', arguments: { tenancyId: records.tenancyId, expectedRevision: 1, action: report } }));
    assert.equal(denied.status, 403); assert.match(denied.headers.get('www-authenticate'), /insufficient_scope/);
    assert.ok(denied.headers.get('www-authenticate').includes(`${read} ${preview}`)); assert.equal(h.dataCalls(), 0);
  }
});

test('official SDK client can discover and preview via signed bearer credentials without changing records', async () => {
  const h = harness(); let token = await signed(); const before = structuredClone(records);
  const client = new Client({ name: 'synthetic-remote-client', version: '1.0.0' });
  const transport = new StreamableHTTPClientTransport(new URL(policy.resource), {
    fetch: async (url, init) => {
      const headers = new Headers(init?.headers); headers.set('host', 'records.example.test'); headers.set('authorization', `Bearer ${token}`);
      return h.handler(new Request(url, { ...init, headers }));
    },
  });
  try {
    await client.connect(transport); assert.equal((await client.listTools()).tools.length, 6);
    const result = await client.callTool({ name: 'prepare_dispute_action', arguments: { tenancyId: records.tenancyId, expectedRevision: 1, action: report } });
    assert.ok(!result.isError, JSON.stringify(result.content));
    assert.equal(result.structuredContent.saved, false); assert.equal(result.structuredContent.revision, 1);
    assert.ok(!JSON.stringify(result).includes(token)); assert.ok(!JSON.stringify(result).includes('confirmationToken'));
    assert.ok((await client.callTool({ name: 'get_settlement_context', arguments: { tenancyId: 'other-tenancy' } })).isError);
    assert.ok((await client.callTool({ name: 'list_tenancies', arguments: { actorId: 'other-account' } })).isError);
    assert.deepEqual(records, before);
    // A replacement access token for the same grant needs no persistent MCP session.
    token = await signed({ exp: now + 800 }); assert.deepEqual(await client.ping(), {});
  } finally { await client.close(); }
});

test('account and token revocation are checked on every request, not only initialization', async () => {
  const token = await signed(); const h = harness();
  assert.equal((await h.send(token)).status, 200); h.revoke();
  assert.equal((await h.send(token)).status, 401); assert.equal(h.lookups(), 2);
  const other = harness(); assert.equal((await other.send(token)).status, 200); other.setGrant({ revoked: true });
  assert.equal((await other.send(token)).status, 403); assert.equal(other.lookups(), 2);
  const consent = harness(); assert.equal((await consent.send(token)).status, 200); consent.setGrant({ scopes: [read] });
  assert.equal((await (await consent.send(token)).json()).result.tools.length, 5);
});

test('lookup outage returns a generic unavailable response and never falls back to a cookie', async () => {
  const h = harness(); h.fail(); const token = await signed(); const response = await h.send(token);
  assert.equal(response.status, 503); assert.ok(!(await response.text()).includes('private connection'));
  assert.equal((await h.send(token, undefined, { headers: { cookie: 'synthetic-session=do-not-use' } })).status, 400);
  assert.equal(h.lookups(), 1); assert.equal(h.dataCalls(), 0);
});

test('remote transport rejects foreign hosts/origins, query tokens and unexpected paths or methods', async () => {
  const h = harness(); const token = await signed();
  for (const changes of [{ url: 'http://records.example.test/mcp' }, { headers: { host: 'attacker.test' } },
    { headers: { origin: 'https://attacker.test' } }, { headers: { 'sec-fetch-site': 'cross-site' } }])
    assert.equal((await h.send(token, undefined, changes)).status, 403);
  assert.equal((await h.send(undefined, undefined, { url: policy.resource + '?access_token=synthetic' })).status, 400);
  assert.equal((await h.send(token, undefined, { url: policy.resource + '/unknown' })).status, 404);
  assert.equal(h.lookups(), 0);
  const method = await h.send(token, undefined, { method: 'GET' });
  assert.equal(method.status, 405); assert.equal(method.headers.get('allow'), 'POST');
});

test('remote adapter reuses body limits and per-account throttling, independent of token rotation', async () => {
  const h = harness({ limits: createMcpLimits({ burst: 2 }, () => now * 1000) }); const token = await signed();
  assert.equal((await h.send(token, '[')).status, 400);
  assert.equal((await h.send(token, ' '.repeat(24001))).status, 413);
  const limited = await h.send(await signed({ exp: now + 800 }));
  assert.equal(limited.status, 429); assert.ok(limited.headers.has('retry-after')); assert.equal(h.dataCalls(), 0);
});

test('untrusted configuration cannot enable weak algorithms, ambiguous URLs or unlimited token lifetime', () => {
  for (const change of [{ issuer: 'http://identity.example.test/' }, { resource: policy.resource + '?token=x' },
    { resource: 'https://user:password@records.example.test/mcp' }, { algorithms: ['HS256'] }, { algorithms: [] },
    { clientIds: [] }, { clientIds: ['bad\nclient'] }, { maxTokenLifetimeSeconds: 999999 }])
    assert.throws(() => createMcpAuthorizer({ ...policy, ...change }, {}, () => now * 1000));
});

test('two valid external identities with the same email retain independent tenancy access', async () => {
  const identityGrants = new Map(['a', 'b'].map(suffix => [suffix, {
    issuer: policy.issuer, subject: suffix, clientId: claims.client_id, resource: policy.resource,
    accountId: `account-${suffix}`, accountStatus: 'ACTIVE', revoked: false, validAfter: 0, expiresAt: now + 900, scopes: [read, preview],
  }]));
  const authenticate = createMcpAuthorizer(policy, { resolveKey: keySet, findGrant: async identity => identityGrants.get(identity.subject) ?? null,
    isTokenRevoked: async () => false }, () => now * 1000);
  const handler = createRemoteMcpHandler({ enabled: true, policy, authenticate, services: {
    list: async actor => ({ role: 'TENANT', viewerId: actor, tenancies: [{ id: `tenancy-${actor}`, status: 'ACTIVE', room: { label: 'Synthetic' } }] }),
    get: async (actor, tenancy) => { if (tenancy !== `tenancy-${actor}`) throw new Error('Tenancy unavailable.'); return { ...records, tenancyId: tenancy }; },
  } });
  const h = harness();
  for (const subject of ['a', 'b']) {
    const token = await signed({ sub: subject, email: 'shared@example.test', role: 'LANDLORD', actorId: 'account-b' });
    const list = await (await handler(h.request(token, rpc('tools/call', { name: 'list_tenancies', arguments: {} })))).json();
    assert.equal(list.result.structuredContent.role, 'TENANT');
    assert.deepEqual(list.result.structuredContent.tenancies.map(t => t.id), [`tenancy-account-${subject}`]);
    const other = subject === 'a' ? 'b' : 'a';
    const denied = await (await handler(h.request(token, rpc('tools/call', { name: 'get_settlement_context', arguments: { tenancyId: `tenancy-account-${other}` } })))).json();
    assert.equal(denied.result.isError, true);
  }
});

test('trusted public-key rotation accepts a new key and rejects a removed key', async () => {
  const h = harness(); const oldToken = await signed();
  let trustedKeys = keySet;
  const authenticate = createMcpAuthorizer(policy, {
    resolveKey: (header, token) => trustedKeys(header, token),
    findGrant: async identity => ({ ...identity, accountId: 'linked-account', accountStatus: 'ACTIVE', revoked: false, validAfter: 0, expiresAt: now + 900, scopes: [read] }),
    isTokenRevoked: async () => false,
  }, () => now * 1000);
  assert.equal((await authenticate(h.request(oldToken))).actorId, 'linked-account');
  trustedKeys = createLocalJWKSet({ keys: [{ ...await exportJWK(other.publicKey), kid: 'rotated', alg: 'ES256' }] });
  await assert.rejects(authenticate(h.request(oldToken)), error => error.status === 401);
  assert.equal((await authenticate(h.request(await signed({}, { kid: 'rotated' }, other.privateKey)))).actorId, 'linked-account');
});

test('a token that expires during account lookup cannot reach record services', async () => {
  let clock = now;
  const authenticate = createMcpAuthorizer(policy, {
    resolveKey: keySet,
    findGrant: async identity => { clock = now + 601; return { ...identity, accountId: 'linked-account', accountStatus: 'ACTIVE', revoked: false, validAfter: 0, expiresAt: now + 900, scopes: [read] }; },
    isTokenRevoked: async () => false,
  }, () => clock * 1000);
  await assert.rejects(authenticate(harness().request(await signed())), error => error.status === 401);
});
