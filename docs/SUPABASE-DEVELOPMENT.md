# Supabase development connection

The owner's isolated Free project is `rgthmushgkithgkmszsy`. Connection uses the session pooler on port 5432. Data API was disabled during project creation. No paid resources are provisioned by these scripts.

## Local configuration

`.env.supabase.local` is ignored by Git and deliberately not loaded by the application. It contains `SUPABASE_DB_HOST`, `SUPABASE_DB_PORT`, `SUPABASE_DB_NAME`, `SUPABASE_DB_USER` and the raw `SUPABASE_DB_PASSWORD`. Never paste credentials into chat, commit them, or log the assembled URL. The connection helper percent-encodes credentials and rejects a different project target. Changing that target requires a deliberate code review.

Run `npm run db:check:supabase` for a read-only inspection of connection identity and public table metadata. It does not read tenant records or run migrations. Errors omit raw database messages because they may contain credentials. Network access may require local execution approval. Run `npm run test:db-config` for synthetic tests with no network or real password.

## Initial connection milestone

The initial live check connected successfully as `postgres`, reported `transaction_read_only=on`, and found no tables in the public schema. This does not imply that Supabase's internal schemas are empty. No schema or data was changed. The Companion still uses local file-backed synthetic sessions; database connectivity alone is not application integration.

## Database and retrieval milestone

The existing Prisma migration chain has now been deployed to the empty development database. There are 26 application tables plus `_prisma_migrations`. All 27 have RLS enabled, and SELECT permission for both `anon` and `authenticated` was verified absent. Existing migration history was retained; no schema reset was used. Legacy transitional drops operated on newly created empty tables, not user records.

`npm run db:initialize:supabase` is an initial-empty-database operation only. It deliberately refuses to run again against the initialized database. Do not reset it to rerun initialization. A failed migration requires inspecting migration metadata before repair, not blind retries.

`npm run db:seed:supabase` initially adds two synthetic tenancies and four users with disabled fixture passwords. Upserts have empty update branches: reruns never overwrite records. No real identity documents, photos or personal data were imported. The separately approved login provisioning step has now assigned generated passwords to those four synthetic users.

`src/lib/companion/database.ts` retrieves source notes, raw agreement text and recorded settlement amounts through Prisma. Identity must come from a verified server session; the function does not authenticate an arbitrary supplied ID. It checks the persisted role, suspension/deletion status, tenant ownership or the property's landlord relationship before retrieving evidence. Draft reports and unrelated personal fields are excluded. Corporate/co-tenant/admin access is deliberately not added yet.

`npm run test:db-records` passed against Supabase: tenant/landlord retrieval, cross-tenancy refusal, draft exclusion, exact source text, integer-sen conversion, differing amounts for the two tenancies, missing-report handling and frontend database-role restrictions. The source-only answer builder quotes stored text; it does not validate the truth of the uploaded text, analyze images or decide liability. This is a baseline for later model integration, not a replacement claim for the existing free-form chat.

The browser `/companion` still uses its isolated local demo. The separate `/records` workspace now uses verified credentials, the restricted database connection and server-authorized retrieval. It does not use the demo role selector or the demo model's fixed source IDs/amounts.

## Authenticated records workspace (2026-09-22)

After the owner's explicit approval, `scripts/provision-records-access.mjs` created the `rentalease_reader` backend login and four synthetic account passwords. Do not rerun this one-time provisioning script. It refuses an existing local configuration; partial failures require inspecting database and file state, not automatic credential rotation.

- `.env.records.local`: ignored backend connection and session-signing secret.
- `.local-runtime/records-test-accounts.json`: ignored synthetic email/password pairs, for local testing only. Never commit or paste these contents into chat.
- `npm run dev:records`: loopback-only `http://127.0.0.1:3031/records`, separate `.next-records` build directory, no paid model/service calls or admin bootstrap.
- `npm run test:records:http`: live login, record access, question, sign-out and restricted database privilege checks. The server must already be running. Repeated suites may reach the five-attempt/15-minute per-email development login limit; do not disable the limit.

The backend role has SELECT access to seven business tables and selected User columns (including the password hash for authentication). It cannot write application data, read KYC submissions or read the User identity-number column. RLS SELECT policies permit this trusted backend role to read all rows in its allowed tables. **Tenant isolation is enforced by server ownership queries, not per-tenant RLS.** This is not a browser credential or production-ready authorization design. `anon`/`authenticated` access remains revoked and the Data API remains disabled.

Credentials authentication rejects deleted/suspended users and unsupported roles. Session validation rechecks persisted role/status and password-change time. Cookies are HTTP-only; local HTTP is allowed only on loopback. The in-memory login limiter and one-hour JWT sessions are development constraints, not a distributed production authentication system. Signing out clears the browser session; it does not revoke a copied JWT everywhere.

`POST /api/records/[tenancyId]/question` accepts only a 1–600-character English question, with a 4096-byte request limit. It verifies the session and tenancy again and re-reads the database on every question. Responses are non-cacheable. The deterministic topic router quotes recorded deposits, refunds, deduction statuses, agreement text or published report notes with source IDs. Withdrawn deductions remain labelled and are excluded from the amount-consistency check. Missing data, inconsistent amounts, unsupported questions and ambiguous follow-ups are explicit; no inferred entitlement, photo assessment, liability verdict or write action is generated. Questions and answers are not persisted as conversation history.

Default mode is source-grounded rule-based Q&A, **not generative AI**. It deliberately cannot handle every English phrasing or multi-part conversation. Source text remains an unverified recorded statement, even when cited. Agreements include their recorded status, which can be draft; draft condition reports are excluded.

### Optional local AI source selection

With the existing local model installed (see `LOCAL-MODEL.md`), start `npm run model:serve`, then `npm run dev:records -- --local-model`. This enables only the already-installed `qwen3:4b` model at `127.0.0.1:11434`. No model downloads, cloud model metadata, redirects or configurable remote endpoints are accepted. Questions and authorized report/agreement text go only to that local service. The four test accounts and backend passwords are never model inputs.

For evidence and otherwise unsupported questions, the model returns **source IDs only**, not answer prose. IDs are checked against the authorized records; every displayed quote is rendered directly from the database. Selecting any report retains all published reports to avoid suppressing contradictory baseline context. Missing reports stay explicit. Amount/action/liability topics handled by the rule router never invoke the model. There is no semantic guarantee the model picks relevant sources; the UI calls them candidate sources, not verified answers. Generated prose, unavailable IDs, timeouts and unavailable models fall back visibly to rule-based answers. Documents over the conservative input limit also fall back without silent truncation.

After inference, the route revalidates the session and tenancy. If records changed, it discards the old selection and returns a fresh rule-based response. `node scripts/test-records-http.mjs --local-model` additionally requires real local source selection for both synthetic tenant accounts and checks displayed notes against database text. Automated mock tests cover invented IDs, generated-prose injection, missing local models, forbidden cloud metadata and zero model calls for critical questions. These safeguards constrain generated facts; they do not establish full source relevance or production readiness.

Verified: four tenant/landlord logins, wrong password, CSRF/origin rejection, own-tenancy listing and detail, cross-tenancy refusal (including questions), rejected actor-ID injection, rejected oversized questions, exact amounts for two different tenancies, unchanged settlement after an action request, no draft reports/password fields, sign-out, and denied database writes/KYC reads. Browser login, selected-tenancy display and cited refund Q&A were also exercised. Suspended/deleted-user and password-change revocation still need expanded live integration scenarios.

## Remaining implementation

### Confirmed submissions milestone (2026-09-23)

The owner explicitly approved development-database writes for report submission and dispute handling. Migration `20260923000100_records_confirmed_submissions` adds `RecordsRevision`, append-only `RecordsActionEvent`, and the narrowly scoped `records_submit` function. It was applied with `node scripts/deploy-records-writes.mjs`, which refuses unexpected pending/failed migrations. Do not edit an already-applied migration or reset the database to rerun it.

The existing `rentalease_reader` credential now additionally has EXECUTE on this function and SELECT on the two new history/revision tables. Despite its historical name, it can therefore perform the following controlled writes. It still has **no direct table INSERT, UPDATE or DELETE permissions**. Function EXECUTE is revoked from PUBLIC, `anon` and `authenticated`. Both new tables have RLS and no public Data API read access.

- REPORT: either fixture tenancy party can append a new text-only MOVE_IN/MOVE_OUT/INSPECTION report with SUBMITTED status. Existing reports are not replaced or automatically accepted.
- DISPUTE: only the fixture tenant can dispute a PROPOSED deduction in an open settlement. Deduction and settlement become DISPUTED; the reason is retained in history and the current dispute-note field. No deposit, deduction or refund amount changes.
- RESPONSE: only the fixture landlord can append a reply referencing an existing dispute in the same tenancy. The reply does not resolve, approve or withdraw the dispute.

Writes are explicitly allowlisted to the two existing synthetic tenancies and four synthetic users. The SECURITY DEFINER function checks persisted role, suspension/deletion and ownership. The backend must still supply a verified session ID; this is a trusted server function, not end-user identity/RLS isolation. Never expose the database credential, give it to browsers, or broaden the fixture allowlist for production without a new authorization/security review.

`POST /api/records/[tenancyId]/actions` has separate prepare and confirm operations. Prepare rechecks access and returns an HMAC-signed preview bound to the actor, tenancy, content, revision and unique operation ID, expiring after ten minutes; it writes nothing. Confirm requires the signed token and explicit confirmation. The database locks the tenancy revision row and commits the business change, history and revision together. Identical retries return the original receipt; altered payloads, wrong actors and stale revisions fail. This revision mechanism covers this workspace's writes; administrative/out-of-band changes must not be run concurrently with user testing. The function independently checks dispute status at execution.

The UI shows a persistent receipt, latest 50 historical submissions and exact confirmation consequences. Failed/uncertain responses keep the same confirmation available for retry. Cancelling the preview does not write; it is not server-side revocation of a copied token. Refresh/sign-out drops the UI preview. Already committed history remains. The app provides no edit/delete of submitted reports/history. Database administrators still retain their normal privileges; this is not an immutable external audit ledger.

`npm run test:records:writes` performs real synthetic writes and intentionally retains them. It verifies anonymous/cross-tenant/origin refusal, actor/amount injection refusal, no-write preview, explicit confirmation, altered signatures, concurrent duplicate requests, stale rejection, report visibility to the other party, tenant-only disputes, landlord-only replies, unchanged amounts and denied direct-table/public-function access. Repeat runs append labelled test reports/replies but do not reset the dispute. Pure tests additionally cover expiry and role/state rules. No files/photos, bank operations, financial approvals or real personal data are involved.

### Next implementation work

Verification for this milestone: 57 workflow/unit tests, two configuration tests, type checking and changed-file lint passed. Live read/write integration checks passed. A browser-submitted synthetic inspection report returned a Supabase receipt and remained in submission history after a full page reload. The existing English cream/green UI was retained, with a separate preview/confirmation panel and history section.

- Apply future reviewed migrations without reset or destructive schema synchronization.
- Harden the development backend-role design before any public deployment or real-user data. Never use the administrative migration account as the application credential.
- Keep synthetic fixtures separate from real user data; expand suspended/deleted-user and role-change integration tests.
- Expand local source-selection relevance evaluation beyond the two synthetic tenancies; do not reuse fixed demo facts. Keep the offline demo separate.
- Extend the confirmed workflow only with explicit action semantics; retain transaction/revision safety and idempotency. Photo storage and dispute resolution/withdrawal remain separate work.
- Evaluate English answers against retrieved records, including missing evidence and adversarial follow-ups. No claim of complete factual accuracy yet.

Connection settings do not automatically enforce tenant isolation. Database roles, RLS where applicable, and server authorization must be tested before real records are introduced.
