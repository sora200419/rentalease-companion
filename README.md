# RentalEase Move-Out Companion

An evidence-based assistant for tenants and landlords completing a move-out and deposit settlement.

**Status: experimental English prototype.** `/demo` is the independent three-item, credential-free walkthrough. `/companion` retains the earlier single-item local-AI experiment. `/records` provides credential-based login, server-authorized Supabase records, source-cited Q&A, confirmed dispute decisions, and private evidence files using synthetic development accounts. Q&A is read-only; a separate limited action conversation routes into explicit confirmation forms. Production hardening and formal Alexa+ integration remain pending. Passing tests does not establish complete factual accuracy or submission readiness. See [model evaluation](docs/LOCAL-MODEL.md), [database setup/security limitations](docs/SUPABASE-DEVELOPMENT.md), and [private evidence and workflow boundaries](docs/PRIVATE-EVIDENCE.md).

## Start here: independent, credential-free demo

Use Node.js 22 and a short checkout path on Windows (for example, `C:/dev/rentalease-companion`). Install and start:

```sh
npm ci
npm run dev:companion
```

Open **http://127.0.0.1:3030/demo**, or `/guide` for the in-app walkthrough. Keep the exact `127.0.0.1:3030` address: this local demo checks its host and origin.

This new three-item demonstration runs without Supabase, AWS or model credentials. It includes four labelled synthetic photos and standard, missing-baseline and conflicting-account scenarios. Tenant and landlord roles can dispute, reply, reject, revise, accept and withdraw, with a separate preview and confirmation for each decision. New scenarios retain old local histories rather than resetting them.

The original single-item `/companion` workspace and private `/records` workspace remain separate and unchanged in purpose. See the [independent demo guide](docs/INDEPENDENT-DEMO.md) for the complete walkthrough, storage boundaries and verification status. Test the running demo with `npm run test:demo:http`.

The submission candidate passed 209 automated regressions, a production build, the complete local HTTP workflow and browser responsive checks on 2026-09-29. See [acceptance scope](docs/FINAL-ACCEPTANCE.md) and [GitHub delivery verification](docs/GITHUB-DELIVERY.md). The intended outcome is three resolved deductions and a MYR 1,755 recorded refund; no money is transferred.

## Try authenticated Supabase records

On the configured development machine, run `npm run dev:records` and open `http://127.0.0.1:3031/records`. Test account credentials are stored only in the ignored `.local-runtime/records-test-accounts.json`; backend secrets are in `.env.records.local`. Sign in, open the authorized tenancy, and ask "What refund and deductions are recorded?" Each question rechecks access and reads current records. No paid model calls, payments or registrations occur. The setup is local-only; do not deploy these development credentials publicly. Run `npm run test:records:http` against the running server for read-path integration checks.

The **Find a way forward** section supports text reports, tenant disputes, landlord replies and withdrawals, revised-amount proposals, and tenant acceptance or rejection. Every write requires a preview and explicit confirmation. Proposing a new amount does not apply it: the tenant must accept it first. Each deduction resolves independently; unresolved items keep the settlement open. An agreed settlement is not a payment. Refreshing drops unconfirmed previews, not saved history, and restores account-scoped conversation and selection for the browser session.

Conversation matching is intentionally conservative. Multiple-item decisions, hypothetical/quoted requests and ambiguous amounts ask for clarification instead of silently selecting an action. An explicit rejection of a reply is distinct from rejection of a pending price proposal. New messages clear unsaved form drafts. Selected-item Q&A retains access, read-only and liability guards; missing/disputed sources are surfaced without resolving factual contradictions.

The **Review at a glance** summary shows each item's contribution and next step, separates pending proposals, and warns about inconsistent amounts. **Download current summary** rechecks access and exports a fresh, dated text snapshot with decisions and source references, never private file contents. The download makes no database changes. Keep exported source text private.

Open `/guide` for the English demonstration guide. It clearly distinguishes the Alexa+ simulation from formal runtime integration and the retained closed database case from the repeatable local walkthrough.

The records conversation now calls a real local **MCP Streamable HTTP** endpoint (`/api/mcp`, protocol `2025-11-25`) using the official SDK. Six authorized tools cover tenancy discovery, settlement context, evidence, agreement text, questions and read-only action previews. Saving remains a separate human confirmation in the records page; MCP exposes no confirmation or payment tool. See [MCP setup, tests and deployment boundaries](docs/MCP.md). Run `npm run test:mcp` for credential-free protocol and safety checks. AWS deployment and formal Alexa+ account linking are not implemented.

Local MCP requests have account-scoped rate limits, concurrent-request caps and bounded body reads. The web client times out after 20 seconds without automatically retrying an action. These limits protect the single-process development workspace; they are not distributed production controls or an AWS spending cap. See the [remote integration acceptance plan](docs/MCP-REMOTE-PLAN.md) before changing the loopback-only policy.

Fixture A retains the earlier reply-acceptance test. Fixture B contains three synthetic deductions for a retained multi-item walkthrough; do not reset either fixture to repeat a demo. `npm run test:records:resolution` checks the full state machine in a rolled-back database transaction. The private evidence reader supports confirmed PNG/JPEG/PDF uploads, authorized original downloads, paired image previews and deduction-specific file references. Four visibly labelled AI-generated photographs are under `demo-assets/evidence/` (outside the public folder). See [setup and limits](docs/PRIVATE-EVIDENCE.md).

For optional local AI source selection, start the installed model with `npm run model:serve`, then start the records server with `npm run dev:records -- --local-model`. Ask "Was the scuff already there when I first arrived?" The model selects authorized source IDs; the server displays exact source text and keeps both move-in and move-out context. Invalid or unavailable AI falls back visibly. Amounts and actions remain rule-based. Verify with `node scripts/test-records-http.mjs --local-model`.

## Try the zero-spend prototype

After installing dependencies with `npm ci`, run:

```sh
npm run dev:companion
```

Open **http://127.0.0.1:3030/companion**. No `.env`, database, AWS credentials, or cloud services are needed for rule mode. The command binds to loopback, enables only the local companion service, blocks inherited APIs/dashboard routes, skips admin bootstrap and avoids the login provider. Normal `npm run dev` retains the inherited application's authentication behavior.

Choose **Compare evidence**, then **Prepare a dispute → Confirm dispute**. Switch to **Landlord**, choose **Review withdrawal → Confirm withdrawal**, and see the proposed refund update. Use **Reset / change demo scenario** to try disputed or missing move-in records. Refresh restores progress but requires a new confirmation for any unsubmitted draft.

See the [walkthrough](docs/DEMO.md) and [local service, model setup and limitations](docs/LOCAL-SERVER.md). Sessions are stored in the ignored `.companion-data/` directory. Use one server process; stale tabs must refresh before writing. Previous browser-only records are not imported.

## What we are building

A tenant asks: "My landlord proposed a RM300 wall-repair deduction, but the mark was there when I moved in. Help me find the record and respond."

The planned assistant retrieves the relevant tenancy, report, photos, and contract clauses; presents sources; drafts a response; and submits an action only after the correct user confirms it. The landlord can review the evidence and resolve the proposal. Both parties can return later to see progress.

The assistant will organize evidence and coordinate existing workflows. It will not decide legal liability, sign agreements, or transfer money automatically.

## Existing baseline

- Landlord, tenant, and administrator accounts.
- Properties, rooms, tenancies, and agreement negotiation/signing.
- Gemini-assisted agreement generation, explanation, translation, and edits.
- Move-in/move-out condition reports, photo comparison, and counter-evidence.
- Deposit deductions, tenant responses, landlord withdrawal, and settlement status.
- Notifications, payment-proof uploads, and contract-hash anchoring code for Sepolia.

These are inherited features, not hackathon additions. Importing their source does not verify the original deployment or external services.

## Local setup

Use Node.js 22 LTS and npm. Provision a separate PostgreSQL database and development service credentials.

1. Copy `.env.example` to `.env` and fill the variables for the features you will test. Never reuse the original application's database. The inherited login flow uses Upstash; the separate companion and records modes above do not use that flow.
2. Install the locked dependencies:

   ```sh
   npm ci
   ```

3. Validate the schema and explicitly apply migrations to the development database:

   ```sh
   npm run db:validate
   npm run db:deploy
   ```

4. Start the application:

   ```sh
   npm run dev
   ```

The inherited development URL is `http://localhost:3000`. No account passwords are committed in this repository. The separate Supabase development setup contains synthetic test accounts. Do not use real identity documents or tenant records when building the demo.

## Checks and builds

```sh
npm run db:generate
npm test
npm run typecheck
npm run lint
npm run build
```

`build` generates the Prisma client and compiles the app; it no longer applies database migrations. Database changes are an explicit `db:deploy` step. External-service integration and full application startup need configured development services.

## Hackathon development

- [Original baseline and new-work boundaries](docs/BASELINE.md)
- [Judge guide and repeatable walkthrough](docs/JUDGE-GUIDE.md)
- [Devpost draft for owner review](docs/DEVPOST-DRAFT.md)
- [English recording script](docs/DEMO-SCRIPT.md)
- [Final acceptance and limitations](docs/FINAL-ACCEPTANCE.md)
- [GitHub candidate and clone verification](docs/GITHUB-DELIVERY.md)
- [MVP and development backlog](docs/ROADMAP.md)
- [Architecture decisions](docs/ARCHITECTURE.md)
- [Developer feedback log](docs/FRICTION_LOG.md)
- [Alexa+ permission findings and submission boundary](docs/ALEXA-ACCESS.md)
- [Remote MCP verification core and remaining OAuth gates](docs/MCP-REMOTE-PLAN.md)
- [Verification performed during setup](docs/VERIFICATION.md)

Target: the Alexa+ simulated web-experience path in the [Amazon Developer Hackathon](https://amazonappdev2026.devpost.com/rules). This is an independent project, not an official Amazon product or a certified Alexa integration. AWS Builder participation will depend on actual, documented AWS integration.

## Repository and licensing

The repository starts private. No new open-source license is asserted by this initialization; review ownership and choose an appropriate license before any public/open-source release. Third-party dependencies retain their respective licenses. Never commit service keys, wallet private keys, `.env` files, uploaded identity documents, or production data.
