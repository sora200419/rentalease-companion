# GitHub delivery — 2026-10-02, updated 2026-10-08

Repository: [sora200419/rentalease-companion](https://github.com/sora200419/rentalease-companion). The repository is public and includes an MIT `LICENSE`.

The final submission candidate includes the independent three-item `/demo`, bundled labelled synthetic photos, missing/conflicting evidence scenarios, confirmed dispute resolution, private records workflows and the separately tested local MCP adapter. Formal Alexa+ integration remains future work.

The 2026-10-08 changes postdate the 2026-10-02 checkpoint below: the browser voice simulation and optional Amazon Bedrock assistant in `/demo` ([VOICE-ASSISTANT.md](VOICE-ASSISTANT.md)), the demo MCP endpoint ([MCP.md](MCP.md)), the [cross-platform lockfile](#cross-platform-lockfile) fix and the MIT `LICENSE`.

## Judge startup

Use Node.js 22. On Windows, choose a short checkout path so generated build files stay below the path-length limit.

```sh
git clone https://github.com/sora200419/rentalease-companion.git
cd rentalease-companion
npm ci
npm run dev:companion
```

Open **http://127.0.0.1:3030/guide** and start the independent demo; in this mode `/` also redirects to `/guide`. In the default rule mode no environment file or cloud credentials are required. Amazon Bedrock is optional and stays off unless `COMPANION_BEDROCK_MODEL` is set; see [VOICE-ASSISTANT.md](VOICE-ASSISTANT.md).

`npm ci` installs the exact lockfile. Do not run `npm install` on Windows and commit the result; see [cross-platform lockfile](#cross-platform-lockfile).

## Delivered-revision checks

Status: **remote-clone verification passed on 2026-10-02**. Application commit `0be979cd2786be9f88184a5203be4be1ec43a335` was pushed to `main`, then cloned from GitHub into a separate empty Windows directory. The final delivery adds only documentation of these results to that tested application commit.

Fixed submission checkpoint: [hackathon-submission-2026-10-02](https://github.com/sora200419/rentalease-companion/tree/hackathon-submission-2026-10-02). This tag identifies the delivered candidate; it does not publish a hosted application.

| Check on the GitHub clone | Result |
| --- | --- |
| Source inventory | 382 tracked files; only placeholder `.env.example`, no private environment files or runtime histories |
| Locked install | PASS: 543 packages, Prisma generation; Node.js 22.15.0 / npm 11.3.0 |
| Automated regressions | PASS: 209/209, no skipped tests |
| TypeScript | PASS |
| Lint | PASS: zero errors, 23 inherited warnings |
| Production build | PASS; inherited missing-Upstash configuration warnings remain |
| Local server startup | PASS: `npm run dev:companion`, exact loopback host |
| Standalone HTTP workflow | PASS: complete dispute resolution, confirmation/cancel/resume, isolation, citations and exact-byte photo reads, missing/conflicting evidence |
| Credential audit | PASS: 382 sources and 478 reachable historical blobs; local private-value comparisons were also checked before the push |

The clone installation used npm's local cache and the Windows system CA trust option; TLS checks remained enabled. No database was initialized, and no cloud service was required. The temporary clone and test-session files were retained. Browser interaction and responsive checks are the prior [2026-09-29 acceptance](FINAL-ACCEPTANCE.md); application code was unchanged during this delivery pass.

The release check scans publishable source paths, high-confidence credential patterns and exact local private credential values without displaying those values. `--history` checks reachable Git blobs too. It is a scoped credential audit, not a general security certification.

```sh
node scripts/audit-release.mjs --ref HEAD --history
npm test
npm run typecheck
npm run lint
npm run build
```

With the dedicated demo server running in another terminal:

```sh
npm run test:demo:http
```

Do not run database initialization, migrations or private-record seeding for this judge walkthrough. See [independent demo instructions](INDEPENDENT-DEMO.md), [local acceptance](FINAL-ACCEPTANCE.md), and [baseline ownership and feature boundaries](BASELINE.md).

**Linux check on 2026-10-08** (container, Node.js 22.22.0, npm 10.9.4): a clean `npm ci`, `npm run build` and `npm run lint` (0 errors, 23 inherited warnings) passed after the lockfile fix below, and `npm test` passed 234/234. This ran in the development working copy, not a fresh GitHub clone. macOS has not been directly tested.

## Cross-platform lockfile

**What broke.** `package-lock.json` had been generated on Windows and listed only the Windows builds of the native optional packages for lightningcss, `@tailwindcss/oxide`, sharp and unrs-resolver (a known npm issue, npm/cli#4828). On Linux, `npm ci && npm run dev:companion` failed with `Cannot find module '../lightningcss.linux-x64-gnu.node'`. macOS is expected to fail the same way but was not directly tested. The 2026-10-02 clone check above ran on Windows, so it could not catch this.

**What was fixed (2026-10-08).** The 73 missing platform entries were added at the exact locked versions. All 544 original entries are unchanged. The Linux check above was run on the fixed lockfile.

**How it is protected.** `tests/lockfile-platforms.test.mjs` runs as part of `npm test`. For every lockfile package that has platform-specific optional dependencies (win32, darwin, linux, linuxmusl, android, freebsd, wasm32), it fails if any of those platform packages is missing from the lockfile. To run it alone from the repository root: `node --test tests/lockfile-platforms.test.mjs`.

**If it fails.** If it fails after `npm install` was run on Windows, do not commit that lockfile. Restore `package-lock.json` from Git, then add or update dependencies from macOS or Linux instead; adding `@aws-sdk/client-bedrock-runtime` on Linux kept all entries. Run `npm test` again before committing.

## Owner delivery items

The repository is public and includes an MIT `LICENSE` (copyright sora200419). The English video, final Devpost copy and actual submission remain owner delivery steps.
