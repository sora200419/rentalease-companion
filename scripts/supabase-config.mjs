import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';

// Deliberately scoped to the owner's separate development project.
export function buildDevelopmentDatabaseUrl(values) {
  if (values.SUPABASE_DB_HOST !== 'aws-0-ap-northeast-1.pooler.supabase.com' ||
      values.SUPABASE_DB_USER !== 'postgres.rgthmushgkithgkmszsy' ||
      values.SUPABASE_DB_PORT !== '5432' || values.SUPABASE_DB_NAME !== 'postgres') {
    throw new Error('Development database target does not match the approved project.');
  }
  if (!values.SUPABASE_DB_PASSWORD || values.SUPABASE_DB_PASSWORD === '[YOUR-PASSWORD]') {
    throw new Error('Set the database password in .env.supabase.local first.');
  }
  const url = new URL(`postgresql://${values.SUPABASE_DB_HOST}:5432/postgres`);
  url.username = encodeURIComponent(values.SUPABASE_DB_USER);
  url.password = encodeURIComponent(values.SUPABASE_DB_PASSWORD);
  url.search = new URLSearchParams({ sslmode: 'require', connection_limit: '1', connect_timeout: '15', pool_timeout: '15' }).toString();
  return url.toString();
}

export function loadDevelopmentDatabaseUrl() {
  // Never print this file, the URL, or raw database error messages.
  return buildDevelopmentDatabaseUrl(parseEnv(readFileSync('.env.supabase.local', 'utf8')));
}
