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

Status: the candidate is being prepared for synchronization. Remote-clone verification will be recorded after the push.

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
