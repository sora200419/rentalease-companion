import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const executable = resolve('.local-runtime/ollama/ollama.exe');
if (!existsSync(executable)) throw new Error('Portable Ollama is not installed. See docs/LOCAL-MODEL.md.');
const child = spawn(executable, ['serve'], {
  stdio: 'inherit', windowsHide: true,
  env: { ...process.env, OLLAMA_HOST: '127.0.0.1:11434', OLLAMA_NO_CLOUD: '1',
    OLLAMA_MODELS: resolve('.local-runtime/models'), OLLAMA_NUM_PARALLEL: '1',
    OLLAMA_MAX_LOADED_MODELS: '1', OLLAMA_CONTEXT_LENGTH: '8192', OLLAMA_KEEP_ALIVE: '2m' },
});
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill());
