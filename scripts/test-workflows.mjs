import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

// Compile the real pure business helpers; no database, credentials or new packages.
const output = mkdtempSync(join(tmpdir(), 'rentalease-tests-'));
try {
  const compile = spawnSync(process.execPath, [
    'node_modules/typescript/bin/tsc', '--module', 'commonjs',
    '--target', 'ES2020', '--strict', '--skipLibCheck',
    '--outDir', output,
    'src/lib/depositSettlementWorkflow.ts',
    'src/lib/conditionReportWorkflow.ts',
    'src/lib/compareConditionReports.ts',
  ], { stdio: 'inherit' });
  if (compile.error) throw compile.error;
  if (compile.status !== 0) process.exitCode = compile.status ?? 1;
  else {
    const tests = spawnSync(process.execPath, ['--test', 'tests/workflows.test.mjs'], {
      stdio: 'inherit',
      env: { ...process.env, RENTALEASE_TEST_OUTPUT: output },
    });
    if (tests.error) throw tests.error;
    process.exitCode = tests.status ?? 1;
  }
} finally {
  // Only remove the exact temporary directory created by this invocation.
  rmSync(output, { recursive: true, force: true });
}
