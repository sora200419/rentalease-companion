# RentalEase Move-Out Companion

An evidence-based assistant for tenants and landlords completing a move-out and deposit settlement.

**Status: experimental English prototype with two separate workspaces.** `/companion` includes local-AI inference over synthetic demo records, demo roles and confirmed local actions. `/records` provides credential-based login, server-authorized Supabase records, source-cited Q&A and confirmed text-report/dispute/landlord-response submissions using synthetic development accounts. Chat is read-only, with optional local AI source-ID selection and exact database quotes (no generated factual prose); only the separate confirmation form can write. Production hardening, private evidence storage and blockchain upgrades remain planned. Passing tests does not establish complete factual accuracy or submission readiness. See [model evaluation](docs/LOCAL-MODEL.md) and [database setup/security limitations](docs/SUPABASE-DEVELOPMENT.md).

## Try authenticated Supabase records

On the configured development machine, run `npm run dev:records` and open `http://127.0.0.1:3031/records`. Test account credentials are stored only in the ignored `.local-runtime/records-test-accounts.json`; backend secrets are in `.env.records.local`. Sign in, open the authorized tenancy, and ask "What refund and deductions are recorded?" Each question rechecks access and reads current records. No paid model calls, payments or registrations occur. The setup is local-only; do not deploy these development credentials publicly. Run `npm run test:records:http` against the running server for read-path integration checks.

The **Review before you send** section supports text reports, tenant disputes of proposed deductions, and landlord replies. Review the exact content, then explicitly confirm to save to Supabase. Reports append new SUBMITTED records; disputes mark the deduction and settlement DISPUTED without changing amounts; replies append history without resolving the dispute. Refreshing discards an unconfirmed preview, not saved history. `npm run test:records:writes` tests these actions on fixture A and retains the synthetic submissions (no reset/delete). Fixture B is left available for a manual first-dispute walkthrough. Photos and file uploads are not implemented in this workflow yet.

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
- [MVP and development backlog](docs/ROADMAP.md)
- [Architecture decisions](docs/ARCHITECTURE.md)
- [Developer feedback log](docs/FRICTION_LOG.md)
- [Verification performed during setup](docs/VERIFICATION.md)

Target: the Alexa+ simulated web-experience path in the [Amazon Developer Hackathon](https://amazonappdev2026.devpost.com/rules). This is an independent project, not an official Amazon product or a certified Alexa integration. AWS Builder participation will depend on actual, documented AWS integration.

## Repository and licensing

The repository starts private. No new open-source license is asserted by this initialization; review ownership and choose an appropriate license before any public/open-source release. Third-party dependencies retain their respective licenses. Never commit service keys, wallet private keys, `.env` files, uploaded identity documents, or production data.
