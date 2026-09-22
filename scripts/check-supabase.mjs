import { PrismaClient } from '@prisma/client';
import { loadDevelopmentDatabaseUrl } from './supabase-config.mjs';

let client;
try {
  client = new PrismaClient({ datasources: { db: { url: loadDevelopmentDatabaseUrl() } }, log: [] });
  const result = await client.$transaction(async tx => {
    await tx.$executeRaw`SET TRANSACTION READ ONLY`;
    const tables = await tx.$queryRaw`
      SELECT tablename, rowsecurity FROM pg_catalog.pg_tables
      WHERE schemaname = 'public' ORDER BY tablename`;
    const connection = await tx.$queryRaw`
      SELECT current_database() AS database, current_user AS role,
      current_setting('transaction_read_only') AS read_only`;
    return { connection, publicTables: tables };
  }, { timeout: 20000, maxWait: 20000 });
  console.log(JSON.stringify({ connected: true, ...result }, null, 2));
} catch (error) {
  // Error messages can contain connection strings; expose only a known error code.
  const code = typeof error?.code === 'string' && /^P\d{4}$/.test(error.code) ? error.code : 'CONFIG_OR_CONNECTION_ERROR';
  console.error(JSON.stringify({ connected: false, code, message: 'Check local configuration, network access and project status. No credentials are printed.' }));
  process.exitCode = 1;
} finally {
  if (client) await client.$disconnect();
}
