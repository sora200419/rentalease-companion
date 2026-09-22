import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDevelopmentDatabaseUrl } from '../scripts/supabase-config.mjs';

const values = { SUPABASE_DB_HOST: 'aws-0-ap-northeast-1.pooler.supabase.com',
  SUPABASE_DB_USER: 'postgres.rgthmushgkithgkmszsy', SUPABASE_DB_PORT: '5432',
  SUPABASE_DB_NAME: 'postgres', SUPABASE_DB_PASSWORD: 'synthetic:@/#?%+ password' };
test('connection encodes password safely and requires TLS with a small pool', () => {
  const url = new URL(buildDevelopmentDatabaseUrl(values));
  assert.equal(decodeURIComponent(url.password), values.SUPABASE_DB_PASSWORD);
  assert.equal(url.hostname, values.SUPABASE_DB_HOST);
  assert.equal(url.hash, '');
  assert.equal(url.searchParams.get('sslmode'), 'require');
  assert.equal(url.searchParams.get('connection_limit'), '1');
});
test('connection rejects missing passwords and unapproved targets', () => {
  for (const change of [{ SUPABASE_DB_PASSWORD: '' }, { SUPABASE_DB_PASSWORD: '[YOUR-PASSWORD]' },
    { SUPABASE_DB_HOST: 'other.example' }, { SUPABASE_DB_USER: 'postgres.other-project' },
    { SUPABASE_DB_PORT: '6543' }, { SUPABASE_DB_NAME: 'production' }]) {
    assert.throws(() => buildDevelopmentDatabaseUrl({ ...values, ...change }));
  }
});
