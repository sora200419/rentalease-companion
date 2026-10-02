import { PrismaClient } from '@prisma/client';
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { loadDevelopmentDatabaseUrl } from './supabase-config.mjs';
let db;
try {
  const url = loadDevelopmentDatabaseUrl();
  db = new PrismaClient({ datasources: { db: { url } }, log: [] });
  const applied = await db.$queryRaw`SELECT migration_name FROM public._prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`;
  const unfinished = await db.$queryRaw`SELECT id FROM public._prisma_migrations WHERE finished_at IS NULL AND rolled_back_at IS NULL`;
  const pending = readdirSync('prisma/migrations', { withFileTypes: true }).filter(d => d.isDirectory() && !applied.some(a => a.migration_name === d.name)).map(d => d.name);
  if (unfinished.length || pending.length !== 1 || pending[0] !== '20260925000100_records_full_dispute_resolution') throw new Error('Unexpected migration state.');
  await db.$disconnect();
  const result = spawnSync(process.execPath, ['node_modules/prisma/build/index.js','migrate','deploy'], { env: { ...process.env, DATABASE_URL: url }, encoding: 'utf8', windowsHide: true, timeout: 180000 });
  if (result.status !== 0) throw new Error('Migration failed.');
  console.log('Applied fixture-scoped dispute decisions and evidence references. Confirmed withdrawals/accepted proposals can update test settlement amounts; direct table writes and public access remain denied.');
} catch { console.error('Deployment stopped; inspect migration state before retrying. Sensitive details suppressed.'); process.exitCode = 1; }
finally { if (db) await db.$disconnect(); }
