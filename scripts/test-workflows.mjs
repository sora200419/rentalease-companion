import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

// Compile real business helpers and MCP adapter; no database or credentials.
const output = mkdtempSync(join(tmpdir(), 'rentalease-tests-'));
try {
  const compile = spawnSync(process.execPath, [
    'node_modules/typescript/bin/tsc', '--module', 'commonjs',
    '--target', 'ES2020', '--strict', '--skipLibCheck', '--esModuleInterop',
    '--outDir', output,
    'src/lib/depositSettlementWorkflow.ts',
    'src/lib/conditionReportWorkflow.ts',
    'src/lib/compareConditionReports.ts',
    'src/lib/companion/demo.ts',
    'src/lib/companion/service.ts',
    'src/lib/companion/records-questions.ts',
    'src/lib/companion/records-model.ts',
    'src/lib/companion/records-actions.ts',
    'src/lib/companion/private-evidence.ts',
    'src/lib/companion/records-dialogue.ts',
    'src/lib/companion/records-evidence.ts',
    'src/lib/companion/records-summary.ts',
    'src/lib/companion/mcp-server.ts',
    'src/lib/companion/mcp-connection.ts',
    'src/lib/companion/mcp-remote.ts',
    'src/lib/companion/judge-demo.ts',
    'src/lib/companion/judge-store.ts',
    'src/lib/companion/judge-mcp.ts',
    'src/lib/companion/voice.ts',
    'src/lib/companion/assistant.ts',
    'src/lib/companion/bedrock.ts',
    'src/lib/companion/judge-assistant.ts',
  ], { stdio: 'inherit' });
  if (compile.error) throw compile.error;
  if (compile.status !== 0) process.exitCode = compile.status ?? 1;
  else {
    const mcpFiles = ['tests/mcp.test.mjs', 'tests/mcp-hardening.test.mjs', 'tests/mcp-remote.test.mjs', 'tests/judge-mcp.test.mjs'];
    const files = process.argv.includes('--mcp') ? mcpFiles : ['tests/workflows.test.mjs', 'tests/companion.test.mjs', 'tests/companion-server.test.mjs', 'tests/records-questions.test.mjs', 'tests/records-actions.test.mjs', 'tests/private-evidence.test.mjs', 'tests/records-resolution.test.mjs', 'tests/records-summary.test.mjs', 'tests/records-dialogue-safety.test.mjs', ...mcpFiles];
    if (!process.argv.includes('--mcp')) files.push('tests/judge-demo.test.mjs', 'tests/assistant.test.mjs', 'tests/lockfile-platforms.test.mjs');
    const tests = spawnSync(process.execPath, ['--test', ...files], {
      stdio: 'inherit',
      env: { ...process.env, RENTALEASE_TEST_OUTPUT: output, NODE_PATH: resolve('node_modules') },
    });
    if (tests.error) throw tests.error;
    process.exitCode = tests.status ?? 1;
  }
} finally {
  // Only remove the exact temporary directory created by this invocation.
  rmSync(output, { recursive: true, force: true });
}
