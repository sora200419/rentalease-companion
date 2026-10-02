# RentalEase Companion — evaluation guide

**Track: Alexa+. Submission path: simulated web experience.** No official Alexa+ runtime, voice service or Amazon SDK is connected. The intended interaction is demonstrated with a browser-based prototype.

## Repeatable walkthrough without credentials

Use Node.js 22, install locked dependencies with `npm ci`, and start `npm run dev:companion`. Open `http://127.0.0.1:3030/guide`, then start the local demo. No cloud credentials or paid model service are needed in default rule mode.

The guide now opens **/demo**, the independent three-item case. It includes bundled synthetic photo pairs, both demo roles, replies, revised offers, rejection/acceptance and withdrawals, all with explicit confirmation. No Supabase credentials are needed.

Follow the [complete independent walkthrough](INDEPENDENT-DEMO.md). Start with a cancelled preview, resolve each item separately, and verify the MYR 1,755 final recorded refund. Try separate missing-baseline and conflicting-account scenarios; previous histories are retained, not reset.

The role switch is a simulation, not database authorization. The older single-item `/companion` demonstration is retained separately. The independent demo passed browser workflow, responsive and no-credentials clean-install acceptance on 2026-09-29; see [verification scope and remaining delivery checks](FINAL-ACCEPTANCE.md).

## Authenticated records on the configured development machine

Run `npm run dev:records` and open `http://127.0.0.1:3031/guide`. Assigned synthetic credentials are delivered privately by the owner, never in this repository or a public video. See [database setup](SUPABASE-DEVELOPMENT.md).

- Sign in as fixture B's tenant and open the authorized tenancy.
- Inspect the three-item summary: repainting withdrawn, cleaning accepted at MYR 20.00, key accepted at MYR 25.00. The retained case records MYR 1,755.00 from a MYR 1,800.00 deposit.
- Select the first item to inspect the wall photo pair; select the second for the kitchen pair. The images say **AI-GENERATED DEMO — NOT REAL EVIDENCE**.
- In the rental conversation, ask “Show evidence for the second deduction.” Check its selected context and citations. Closed items intentionally offer no new settlement decisions.
- Review the saved disputes, withdrawal, reply rejection, revised proposal, revised-amount acceptance and final item acceptance. Preview cancellation is verified by UAT, not by inventing a saved event.
- Download the current text summary. Check the revision, excluded withdrawn amount, references and decision history. It is not a payment receipt.
- Sign out and use the corresponding landlord account to review the same case. Do not reset retained database history.

The rental conversation queries and previews through a real local MCP connection using the official TypeScript SDK. Its six tools are read-only; confirmation stays in the application. This does not connect to a formal Alexa+ runtime. See [MCP.md](MCP.md) for protocol and authorization boundaries.

The records endpoint is local-only. A remote judge cannot reach a localhost URL on the owner's machine. A safe remote evaluation arrangement or separate isolated setup must be agreed before submission; existing development credentials must not be published.

## Reproducible checks

- `npm test`: pure business, conversation, evidence and summary regressions; no cloud credentials.
- `npm run test:mcp`: standard-client protocol, tool schemas, preview and access-isolation checks with synthetic in-memory records.
- `npm run typecheck`: TypeScript verification.
- `npm run test:records:http`: against the running records server; checks four assigned logins, MCP handshake/tools/previews, cross-tenancy denial, read-only answers, summaries and sign-out.
- `npm run test:records:resolution`: database state-machine checks in a rolled-back transaction, not a fixture reset.
- `npm run test:records:evidence`: private file read/byte-integrity checks; see the script for fixture prerequisites.

Network checks require the existing development configuration. Never use production tenant data.

## Limits and provenance

English only. Conversation matching is limited, optional AI source selection is experimental, and no image analysis or legal decision is made. All amounts and confirmations remain deterministic. Exported copies must be kept private by the recipient.

Inherited FYP code and new work are separated in [BASELINE.md](BASELINE.md). The [UAT log](RECORDS-UAT.md) describes the exact browser path verified, not every possible branch. The [local-model log](LOCAL-MODEL.md) records known semantic limitations.
