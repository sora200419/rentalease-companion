// Audit publishable Git sources without displaying credentials or file contents.
// Default: current candidate. --ref <commit/tag>: committed tree. --history:
// also inspect every reachable Git blob. No files or credentials are uploaded.
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
const refIndex = args.indexOf('--ref');
const ref = refIndex < 0 ? null : args[refIndex + 1];
if (refIndex >= 0 && (!ref || ref.startsWith('-'))) throw new Error('Supply a Git reference after --ref.');
const git = (parameters, input) => execFileSync('git', parameters, {
  cwd: resolve('.'), input, maxBuffer: 64 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'],
});
const findings = [];
const privateValues = new Map();
const remember = (value, name) => {
  if (typeof value !== 'string' || value.length < 8 || /^(?:REPLACE_|YOUR_|CHANGE_ME|example|placeholder)/i.test(value)) return;
  privateValues.set(value, name);
};
for (const filename of ['.env', '.env.local', '.env.records.local']) {
  let contents;
  try { contents = await readFile(filename, 'utf8'); } catch (error) {
    if (error.code === 'ENOENT') continue;
    throw new Error('Cannot read local private configuration for comparison: ' + filename);
  }
  for (const line of contents.split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match) continue;
    const [, name, raw] = match;
    const quoted = raw.startsWith('"') || raw.startsWith("'");
    const value = quoted ? raw.slice(1, raw.lastIndexOf(raw[0])) : raw.replace(/\s+#.*$/, '');
    if (/(?:SECRET|PASSWORD|TOKEN|API_KEY|PRIVATE_KEY|SERVICE_ROLE_KEY|ACCESS_KEY)/.test(name)) remember(value, name);
    if (/DATABASE_URL|DIRECT_URL/.test(name)) {
      try { remember(decodeURIComponent(new URL(value).password), name + ' password'); } catch { /* Not a configured URI. */ }
    }
  }
}
try {
  const accounts = JSON.parse(await readFile('.local-runtime/records-test-accounts.json', 'utf8'));
  const collect = (value) => {
    if (!value || typeof value !== 'object') return;
    for (const [name, entry] of Object.entries(value)) {
      if (/password|secret|token/i.test(name)) remember(entry, 'private synthetic account credential');
      collect(entry);
    }
  };
  collect(accounts);
} catch (error) {
  if (error.code !== 'ENOENT') throw new Error('Cannot inspect private account credentials for comparison.');
}

const patterns = [
  ['private key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['AWS access key', /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/],
  ['Supabase secret key', /\bsb_secret_[A-Za-z0-9_-]{20,}\b/],
  ['GitHub credential', /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{50,})\b/],
  ['Google API credential', /\bAIza[A-Za-z0-9_-]{35}\b/],
  ['bearer JWT', /\beyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{20,}\b/],
];
const privatePath = name => name !== '.env.example' && (
  name.split('/').some(part => /^\.env(?:\.|$)/.test(part)) ||
  /^(?:\.local-runtime|\.companion-data|uploads|private-data|node_modules|\.next(?:-records)?)(?:\/|$)/.test(name) ||
  /\.(?:pem|key|p12|pfx|sqlite|db|zip)$/i.test(name)
);
const inspect = (name, bytes, scope) => {
  if (privatePath(name)) findings.push({ scope, file: name, reason: 'private or generated path' });
  // Skip binaries; configuration and authentication material are text.
  if (bytes.includes(0)) return;
  const contents = bytes.toString('utf8');
  for (const [value, keyName] of privateValues) {
    if (contents.includes(value)) findings.push({ scope, file: name, reason: 'matches ' + keyName });
  }
  for (const [reason, pattern] of patterns) {
    if (pattern.test(contents)) findings.push({ scope, file: name, reason });
  }
};
const names = ref
  ? git(['ls-tree', '-r', '--name-only', '-z', ref]).toString().split('\0').filter(Boolean)
  : [...new Set(git(['ls-files', '-z', '--cached', '--others', '--exclude-standard']).toString().split('\0').filter(Boolean))];
for (const name of names) {
  inspect(name, ref ? git(['show', ref + ':' + name]) : await readFile(name), ref ?? 'candidate');
}
let historyBlobs = 0;
if (args.includes('--history')) {
  const entries = git(['rev-list', '--objects', '--all']).toString().trim().split('\n');
  const objects = new Map(entries.map(line => {
    const split = line.indexOf(' ');
    return split < 0 ? [line.trim(), ''] : [line.slice(0, split), line.slice(split + 1).trim()];
  }));
  const types = git(['cat-file', '--batch-check=%(objectname) %(objecttype)'], [...objects.keys()].join('\n') + '\n').toString().trim().split('\n');
  for (const line of types) {
    const [id, type] = line.split(' ');
    if (type !== 'blob') continue;
    historyBlobs++;
    inspect(objects.get(id) || id, git(['cat-file', 'blob', id]), 'reachable history');
  }
}
// Names/reasons only: never include detected values in stdout or exceptions.
console.log(JSON.stringify({ result: findings.length ? 'FAIL' : 'PASS', scope: ref ?? 'local candidate', files: names.length, historyBlobs, findings }, null, 2));
if (findings.length) process.exitCode = 1;
