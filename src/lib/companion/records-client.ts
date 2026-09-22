import { PrismaClient } from '@prisma/client';
const shared = globalThis as unknown as { recordsDb?: PrismaClient };
export function recordsDb() {
  if (process.env.COMPANION_RECORDS_MODE !== '1' || !process.env.RECORDS_DATABASE_URL) throw new Error('Records mode unavailable.');
  if (!shared.recordsDb) shared.recordsDb = new PrismaClient({ datasources: { db: { url: process.env.RECORDS_DATABASE_URL } }, log: [] });
  return shared.recordsDb;
}
