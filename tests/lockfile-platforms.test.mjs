import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// npm can drop other platforms' native binaries from the lockfile when it is
// regenerated on one OS (npm/cli#4828). A Windows-only lock then breaks
// `npm ci` on macOS and Linux, so every platform package must stay listed.
const platform = /(?:^|[-/])(?:win32|darwin|linux|linuxmusl|android|freebsd|wasm32)(?:-|$)/;

test('lockfile keeps every platform-specific optional binary', () => {
  const { packages } = JSON.parse(readFileSync('package-lock.json', 'utf8'));
  const missing = [];
  for (const [path, meta] of Object.entries(packages)) {
    for (const name of Object.keys(meta.optionalDependencies ?? {})) {
      if (!platform.test(name)) continue;
      if (!packages['node_modules/' + name] && !packages[path + '/node_modules/' + name]) missing.push(path + ' -> ' + name);
    }
  }
  assert.deepEqual(missing, [], 'Restore the missing entries before committing; see docs/GITHUB-DELIVERY.md.');
});
