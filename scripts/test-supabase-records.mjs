import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';
import { loadDevelopmentDatabaseUrl } from './supabase-config.mjs';
const output = mkdtempSync(join(tmpdir(), 'rentalease-records-'));
let db;
let stage = 'compile';
try {
  const compile = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc', '--module', 'commonjs', '--target', 'ES2020', '--strict', '--skipLibCheck', '--outDir', output, 'src/lib/companion/database.ts'], { stdio: 'inherit' });
  assert.equal(compile.status, 0);
  const { retrieveTenancyRecords, recordEvidenceAnswer, decimalToSen } = await import(pathToFileURL(join(output, 'database.js')).href);
  stage = 'amount conversion';
  assert.equal(decimalToSen('0.29'), 29);
  assert.equal(decimalToSen('2400'), 240000);
  assert.throws(() => decimalToSen('-1'));
  assert.throws(() => decimalToSen('0.001'));
  db = new PrismaClient({ datasources: { db: { url: loadDevelopmentDatabaseUrl() } }, log: [] });
  stage = 'authorized tenant and landlord';
  const a = await retrieveTenancyRecords(db, 'fixture-a-tenant', 'fixture-a-tenancy');
  const landlord = await retrieveTenancyRecords(db, 'fixture-a-landlord', 'fixture-a-tenancy');
  assert.equal(a.depositSen, 240000); assert.equal(a.settlement.recordedRefundSen, 210000);
  assert.equal(a.settlement.paymentRecorded, false);
  assert.deepEqual(a.evidence, landlord.evidence);
  assert.equal(a.evidence.length, 2); assert.equal(a.evidence.some(r => r.status === 'DRAFT'), false);
  stage = 'cross-tenancy denial';
  for (const id of ['fixture-b-tenant', 'fixture-b-landlord', 'nonexistent', '']) {
    await assert.rejects(retrieveTenancyRecords(db, id, 'fixture-a-tenancy'), /Tenancy unavailable/);
  }
  await assert.rejects(retrieveTenancyRecords(db, 'fixture-a-tenant', 'fixture-b-tenancy'), /Tenancy unavailable/);
  stage = 'source fidelity';
  const answer = recordEvidenceAnswer(a);
  for (const source of a.evidence) { assert.ok(answer.text.includes(source.text)); assert.ok(answer.sourceIds.includes(source.id)); }
  assert.ok(answer.text.includes(a.agreement.text));
  assert.ok(!answer.text.includes('PRIVATE_DRAFT'));
  assert.ok(!JSON.stringify(a).includes('password'));
  const b = await retrieveTenancyRecords(db, 'fixture-b-tenant', 'fixture-b-tenancy');
  assert.equal(b.depositSen, 180000); assert.equal(b.settlement.recordedRefundSen, 170000);
  stage = 'missing records';
  assert.match(recordEvidenceAnswer({ ...a, evidence: [], agreement: null }).text, /No published move-in report/);
  stage = 'database exposure';
  const exposure = await db.$queryRaw`SELECT tablename, rowsecurity,
    has_table_privilege('anon', format('public.%I', tablename), 'SELECT') AS anon_read,
    has_table_privilege('authenticated', format('public.%I', tablename), 'SELECT') AS authenticated_read
    FROM pg_catalog.pg_tables WHERE schemaname = 'public'`;
  assert.ok(exposure.length > 0);
  assert.ok(exposure.every(t => t.rowsecurity && !t.anon_read && !t.authenticated_read));
  console.log('PASS: database retrieval, owner/tenant access, cross-tenancy denial, draft exclusion, exact source text, distinct amounts, missing evidence and API-role table restrictions. This is not an end-to-end login test.');
} catch {
  console.error(`Records verification failed at: ${stage}. Raw errors suppressed to protect credentials.`);
  process.exitCode = 1;
} finally { if (db) await db.$disconnect(); rmSync(output, { recursive: true, force: true }); }
