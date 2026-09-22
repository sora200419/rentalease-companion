import { PrismaClient } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import bcrypt from 'bcryptjs';
import { loadDevelopmentDatabaseUrl } from './supabase-config.mjs';
const file = '.env.records.local';
let db;
try {
  if (existsSync(file)) throw new Error('Local access already configured.');
  const ownerUrl = loadDevelopmentDatabaseUrl();
  db = new PrismaClient({ datasources: { db: { url: ownerUrl } }, log: [] });
  const password = randomBytes(32).toString('hex');
  const secret = randomBytes(48).toString('hex');
  const accounts = [];
  for (const id of ['fixture-a-tenant', 'fixture-a-landlord', 'fixture-b-tenant', 'fixture-b-landlord']) {
    const userPassword = randomBytes(18).toString('hex');
    accounts.push({ id, email: `${id}@example.invalid`, password: userPassword, hash: await bcrypt.hash(userPassword, 12) });
  }
  await db.$transaction(async tx => {
    // Fixed role/identifiers and generated hex secret only; no user SQL interpolation.
    await tx.$executeRawUnsafe(`CREATE ROLE rentalease_reader LOGIN PASSWORD '${password}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS CONNECTION LIMIT 3`);
    await tx.$executeRawUnsafe('GRANT USAGE ON SCHEMA public TO rentalease_reader');
    await tx.$executeRawUnsafe('GRANT SELECT (id, name, email, password, role, "isSuspended", "deletedAt", "passwordChangedAt") ON public."User" TO rentalease_reader');
    for (const table of ['User', 'Property', 'Room', 'Tenancy', 'ConditionReport', 'Agreement', 'DepositRefund', 'DepositDeduction']) {
      if (table !== 'User') await tx.$executeRawUnsafe(`GRANT SELECT ON public."${table}" TO rentalease_reader`);
      await tx.$executeRawUnsafe(`CREATE POLICY records_server_read ON public."${table}" FOR SELECT TO rentalease_reader USING (true)`);
    }
    for (const account of accounts) {
      const changed = await tx.user.updateMany({ where: { id: account.id, email: account.email, password: '!disabled-fixture-login!' }, data: { password: account.hash, passwordChangedAt: new Date() } });
      if (changed.count !== 1) throw new Error('Fixture precondition failed.');
    }
  }, { timeout: 30000 });
  const url = new URL(ownerUrl);
  url.username = 'rentalease_reader.rgthmushgkithgkmszsy'; url.password = password;
  writeFileSync(file, `# Generated private read-only app access. Do not commit or share.\nRECORDS_DATABASE_URL="${url}"\nRECORDS_AUTH_SECRET="${secret}"\n`, { flag: 'wx', mode: 0o600 });
  mkdirSync('.local-runtime', { recursive: true });
  writeFileSync('.local-runtime/records-test-accounts.json', JSON.stringify(accounts.map(({ id, email, password }) => ({ id, email, password })), null, 2), { flag: 'wx', mode: 0o600 });
  console.log('Read-only server role and four synthetic test logins created. Secrets saved only to ignored local files. RLS policies permit this trusted server role to read; tenancy isolation is enforced by server authorization.');
} catch {
  console.error('Provisioning stopped. Inspect role/local-file state before retrying. No secrets printed.'); process.exitCode = 1;
} finally { if (db) await db.$disconnect(); }
