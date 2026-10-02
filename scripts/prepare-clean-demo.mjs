// Snapshot the current candidate sources, not private files or Git history.
// Deliberately includes uncommitted/untracked candidate code; this is NOT proof
// that a remote GitHub clone contains the same revision.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFile, lstat, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
const source = resolve('.');
// Keep the independent tree outside this repository: nested lockfiles alter
// Turbopack root inference, and deeply nested Windows paths can exceed limits.
const destination = await mkdtemp(join(tmpdir(), 'rentalease-clean-'));
const roots = new Set(['src', 'public', 'prisma', 'scripts', 'tests', 'docs', 'demo-assets']);
const files = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: source }).toString().split('\0').filter(Boolean);
const manifest = [];
for (const name of [...new Set(files)].sort()) {
  const parts = name.split('/');
  if (parts.some(p => p === '..' || p.startsWith('.env') || ['node_modules', '.git', '.next', '.next-records', '.companion-data', '.local-runtime', 'uploads', 'private-data'].includes(p))) continue;
  if (/\.(?:pem|key|p12|pfx|sqlite|db|zip)$/i.test(name)) continue;
  if (!roots.has(parts[0]) && !(parts.length === 1 && (/^(?:package(?:-lock)?|tsconfig)\.json$/.test(name) || /^(?:next|postcss|eslint)\.config\.(?:ts|mjs|js)$/.test(name) || name.endsWith('.md') || name === '.gitignore' || /^LICENSE(?:\.[\w]+)?$/.test(name)))) continue;
  const from = resolve(source, name), to = resolve(destination, name);
  if (!from.startsWith(source + sep) || !to.startsWith(destination + sep)) throw new Error('Path outside candidate tree.');
  const stat = await lstat(from);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Only regular source files may be copied: ' + name);
  await mkdir(dirname(to), { recursive: true });
  await copyFile(from, to);
  manifest.push({ file: name, bytes: stat.size, sha256: createHash('sha256').update(await readFile(to)).digest('hex') });
}
for (const required of ['package.json', 'package-lock.json', 'prisma/schema.prisma', 'src/app/demo/JudgeDemo.tsx', 'src/lib/companion/judge-demo.ts']) {
  if (!manifest.some(entry => entry.file === required)) throw new Error('Missing candidate source: ' + required);
}
const digest = createHash('sha256').update(JSON.stringify(manifest)).digest('hex');
await writeFile(join(destination, 'CANDIDATE-MANIFEST.json'), JSON.stringify({ source: 'local working tree; not a remote clone', createdAt: new Date().toISOString(), digest, files: manifest }, null, 2));
console.log(JSON.stringify({ destination, candidate: relative(source, destination), fileCount: manifest.length, digest, excluded: 'environment files, node_modules, build output, private files, runtime histories, Git metadata' }, null, 2));
