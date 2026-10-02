# GitHub delivery — 2026-10-02

Repository: [sora200419/rentalease-companion](https://github.com/sora200419/rentalease-companion).

The final submission candidate includes the independent three-item `/demo`, bundled labelled synthetic photos, missing/conflicting evidence scenarios, confirmed dispute resolution, private records workflows and the separately tested local MCP adapter. Formal Alexa+ integration remains future work.

## Judge startup

Use Node.js 22. On Windows, choose a short checkout path so generated build files stay below the path-length limit.

```sh
git clone https://github.com/sora200419/rentalease-companion.git
cd rentalease-companion
npm ci
npm run dev:companion
```

Open **http://127.0.0.1:3030/guide** and start the independent demo. No environment file or cloud credentials are required. Private repository access must be arranged by the owner before judging.

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

## Owner delivery items

Source access/licensing, the English video, final Devpost copy and actual submission remain owner delivery steps. Syncing source does not change repository visibility, add collaborators or publish an open-source licence.
