import { PrismaClient } from '@prisma/client';
import { spawnSync } from 'node:child_process';
import { loadDevelopmentDatabaseUrl } from './supabase-config.mjs';

let client;
try {
  if (!process.argv.includes('--apply')) throw new Error('Explicit apply required.');
  const url = loadDevelopmentDatabaseUrl();
  client = new PrismaClient({ datasources: { db: { url } }, log: [] });
  const existing = await client.$queryRaw`SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public'`;
  if (existing.length) throw new Error('Database is not empty; inspect migration status manually.');
  await client.$disconnect();
  // Capture rather than print CLI output: errors may contain credentials.
  const result = spawnSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: url }, encoding: 'utf8', windowsHide: true, timeout: 180000,
  });
  if (result.status !== 0) throw new Error('Migration failed; inspect status with a credential-safe tool.');
  await client.$transaction(async tx => {
    await tx.$executeRawUnsafe('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated');
    const tables = await tx.$queryRaw`SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public'`;
    for (const { tablename } of tables) {
      const identifier = '"' + tablename.replace(/"/g, '""') + '"';
      await tx.$executeRawUnsafe(`ALTER TABLE public.${identifier} ENABLE ROW LEVEL SECURITY`);
    }
  }, { timeout: 30000 });
  const tables = await client.$queryRaw`SELECT tablename, rowsecurity FROM pg_catalog.pg_tables WHERE schemaname = 'public' ORDER BY tablename`;
  console.log(JSON.stringify({ initialized: true, tables }, null, 2));
} catch {
  console.error('Initialization stopped. No credential details printed. Check empty-target precondition and migration status before retrying.');
  process.exitCode = 1;
} finally { if (client) await client.$disconnect(); }
