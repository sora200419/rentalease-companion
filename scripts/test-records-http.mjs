import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { PrismaClient } from '@prisma/client';
const base = 'http://127.0.0.1:3031';
const accounts = JSON.parse(readFileSync('.local-runtime/records-test-accounts.json', 'utf8'));
let stage = 'anonymous access';
let db;
function client() {
  const jar = new Map();
  return async (path, options = {}) => {
    const response = await fetch(base + path, { ...options, redirect: 'manual', headers: {
      Cookie: [...jar].map(([key, value]) => `${key}=${value}`).join('; '), ...options.headers,
    } });
    for (const cookie of response.headers.getSetCookie()) {
      const pair = cookie.split(';')[0]; const at = pair.indexOf('=');
      jar.set(pair.slice(0, at), pair.slice(at + 1));
    }
    return response;
  };
}
async function login(request, account, password = account.password) {
  const csrf = await (await request('/api/auth/csrf')).json();
  return request('/api/auth/callback/credentials', { method: 'POST', headers: { Origin: base, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ csrfToken: csrf.csrfToken, email: account.email, password, json: 'true', callbackUrl: `${base}/records` }) });
}
try {
  assert.equal((await fetch(`${base}/api/records`)).status, 401);
  assert.equal((await fetch(`${base}/api/records/fixture-a-tenancy`)).status, 401);
  const bad = client();
  stage = 'wrong password';
  await login(bad, accounts[0], 'wrong-password-for-negative-test');
  assert.equal((await bad('/api/records')).status, 401);
  stage = 'same-origin and csrf';
  assert.equal((await fetch(`${base}/api/auth/callback/credentials`, { method: 'POST', headers: { Origin: 'https://unrelated.example' } })).status, 403);
  const noCsrf = client();
  await noCsrf('/api/auth/callback/credentials', { method: 'POST', headers: { Origin: base, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ email: accounts[0].email, password: accounts[0].password, json: 'true' }) });
  assert.equal((await noCsrf('/api/records')).status, 401);
  for (const account of accounts) {
    stage = `login and isolation (${account.id})`;
    const request = client();
    const signedIn = await login(request, account);
    assert.equal(signedIn.status, 200);
    assert.ok(signedIn.headers.getSetCookie().some(c => c.includes('next-auth.session-token') && /HttpOnly/i.test(c)));
    const listing = await request('/api/records');
    assert.equal(listing.status, 200); assert.match(listing.headers.get('cache-control'), /no-store/);
    const data = await listing.json();
    const key = account.id.includes('-a-') ? 'a' : 'b';
    assert.deepEqual(data.tenancies.map(t => t.id), [`fixture-${key}-tenancy`]);
    assert.equal(data.role, account.id.endsWith('landlord') ? 'LANDLORD' : 'TENANT');
    const response = await request(`/api/records/fixture-${key}-tenancy`);
    assert.equal(response.status, 200);
    const detail = await response.json();
    assert.equal(detail.records.depositSen, key === 'a' ? 240000 : 180000);
    assert.equal(detail.records.settlement.recordedRefundSen, key === 'a' ? 210000 : 170000);
    assert.equal(detail.answer.provider, 'records');
    assert.equal(detail.records.evidence.length, 2);
    assert.ok(!JSON.stringify(detail).includes('PRIVATE_DRAFT'));
    assert.ok(!JSON.stringify(detail).includes('password'));
    stage = `grounded questions (${account.id})`;
    const ask = (body, id = `fixture-${key}-tenancy`) => request(`/api/records/${id}/question`, { method: 'POST', headers: { Origin: base, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const answered = await ask({ question: 'What refund and deductions are recorded?' });
    assert.equal(answered.status, 200); assert.match(answered.headers.get('cache-control'), /no-store/);
    const grounded = await answered.json();
    assert.match(grounded.answer.text, key === 'a' ? /MYR 2100.00/ : /MYR 1700.00/);
    assert.ok(grounded.answer.sourceIds.includes(detail.records.settlement.id));
    assert.equal((await ask({ question: 'refund', actorId: account.id })).status, 400);
    assert.equal((await ask({ question: 'a'.repeat(601) })).status, 400);
    assert.equal((await ask({ question: 'a'.repeat(5000) })).status, 413);
    assert.equal((await ask({ question: 'refund' }, `fixture-${key === 'a' ? 'b' : 'a'}-tenancy`)).status, 404);
    const blockedAction = await (await ask({ question: 'Send my refund now' })).json();
    assert.equal(blockedAction.answer.topic, 'read-only');
    const fresh = await (await request(`/api/records/fixture-${key}-tenancy`)).json();
    assert.deepEqual(fresh.records.settlement, detail.records.settlement);
    if (process.argv.includes('--local-model') && account.id.endsWith('-tenant')) {
      stage = `live local source selection (${account.id})`;
      const selectedResponse = await ask({ question: 'Was the scuff already there when I first arrived?' });
      assert.equal(selectedResponse.status, 200);
      const selected = await selectedResponse.json();
      assert.equal(selected.answer.selection, 'local-model');
      assert.ok(selected.answer.sourceIds.includes(`fixture-${key}-in`));
      assert.ok(selected.answer.sourceIds.includes(`fixture-${key}-out`));
      for (const report of detail.records.evidence) assert.ok(selected.answer.text.includes(report.text));
      assert.ok(selected.answer.sourceIds.every(id => [...detail.records.evidence.map(e => e.id), detail.records.agreement.id].includes(id)));
      console.log(`PASS: local model selected authorized source IDs for tenancy ${key}; displayed notes match database text.`);
    }
    assert.equal((await request(`/api/records/fixture-${key === 'a' ? 'b' : 'a'}-tenancy?actorId=fixture-b-landlord`)).status, 404);
    assert.equal((await request('/api/records/not-a-tenancy')).status, 404);
    for (const path of ['/api/companion/role', '/api/deposit-refund', '/api/register']) assert.equal((await request(path)).status, 503);
    assert.equal((await request(`/api/records/fixture-${key}-tenancy`, { method: 'POST', headers: { Origin: base } })).status, 405);
    const csrf = await (await request('/api/auth/csrf')).json();
    await request('/api/auth/signout', { method: 'POST', headers: { Origin: base, 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ csrfToken: csrf.csrfToken, json: 'true' }) });
    assert.equal((await request('/api/records')).status, 401);
    assert.equal((await ask({ question: 'refund' })).status, 401);
  }
  stage = 'restricted database role';
  const settings = parseEnv(readFileSync('.env.records.local', 'utf8'));
  db = new PrismaClient({ datasources: { db: { url: settings.RECORDS_DATABASE_URL } }, log: [] });
  const [role] = await db.$queryRaw`SELECT current_user AS name, rolsuper, rolbypassrls, rolcreatedb, rolcreaterole FROM pg_roles WHERE rolname = current_user`;
  assert.equal(role.name, 'rentalease_reader');
  assert.ok(!role.rolsuper && !role.rolbypassrls && !role.rolcreatedb && !role.rolcreaterole);
  await assert.rejects(db.$executeRaw`UPDATE public."Tenancy" SET status = status WHERE false`);
  await assert.rejects(db.$queryRaw`SELECT "icNumber" FROM public."User" LIMIT 0`);
  await assert.rejects(db.$queryRaw`SELECT id FROM public."KycSubmission" LIMIT 0`);
  console.log('PASS: four real test logins, wrong password, CSRF/origin checks, tenant and landlord isolation, no drafts/secrets, read-only endpoints, sign-out and restricted database privileges.');
} catch {
  console.error(`FAIL at ${stage}. Sensitive response bodies and raw database errors suppressed.`); process.exitCode = 1;
} finally { if (db) await db.$disconnect(); }
