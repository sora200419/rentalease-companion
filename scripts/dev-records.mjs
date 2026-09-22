import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { spawn } from 'node:child_process';
const config = parseEnv(readFileSync('.env.records.local', 'utf8'));
const url = new URL(config.RECORDS_DATABASE_URL);
if (url.hostname !== 'aws-0-ap-northeast-1.pooler.supabase.com' || decodeURIComponent(url.username) !== 'rentalease_reader.rgthmushgkithgkmszsy' || !config.RECORDS_AUTH_SECRET) throw new Error('Invalid records-mode configuration.');
const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--hostname', '127.0.0.1', '--port', '3031'], {
  stdio: 'inherit', windowsHide: true, env: { ...process.env, COMPANION_OFFLINE_DEMO: '0', COMPANION_RECORDS_MODE: '1',
    RECORDS_DATABASE_URL: config.RECORDS_DATABASE_URL, NEXTAUTH_SECRET: config.RECORDS_AUTH_SECRET,
    RECORDS_LOCAL_MODEL: process.argv.includes('--local-model') ? 'qwen3:4b' : '',
    NEXTAUTH_URL: 'http://127.0.0.1:3031', NEXT_TELEMETRY_DISABLED: '1' },
});
child.on('error', () => { console.error('Records server could not start.'); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
