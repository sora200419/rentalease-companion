import { spawn } from 'node:child_process';

// This dedicated mode also blocks all inherited backend routes in the proxy.
const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--hostname', '127.0.0.1', '--port', '3030'], {
  stdio: 'inherit', env: { ...process.env, COMPANION_OFFLINE_DEMO: '1', NEXT_TELEMETRY_DISABLED: '1' },
});
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
