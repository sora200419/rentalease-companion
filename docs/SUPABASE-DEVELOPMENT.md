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

`npm run db:seed:supabase` adds two synthetic tenancies and four users with disabled fixture passwords. Upserts have empty update branches: reruns never overwrite records. No real identity documents, photos, usable login credentials or personal data were imported.

`src/lib/companion/database.ts` retrieves source notes, raw agreement text and recorded settlement amounts through Prisma. Identity must come from a verified server session; the function does not authenticate an arbitrary supplied ID. It checks the persisted role, suspension/deletion status, tenant ownership or the property's landlord relationship before retrieving evidence. Draft reports and unrelated personal fields are excluded. Corporate/co-tenant/admin access is deliberately not added yet.

`npm run test:db-records` passed against Supabase: tenant/landlord retrieval, cross-tenancy refusal, draft exclusion, exact source text, integer-sen conversion, differing amounts for the two tenancies, missing-report handling and frontend database-role restrictions. The source-only answer builder quotes stored text; it does not validate the truth of the uploaded text, analyze images or decide liability. This is a baseline for later model integration, not a replacement claim for the existing free-form chat.

The browser `/companion` still uses its isolated local demo. The retrieval module has no HTTP endpoint yet and is not connected to the model. Live checks used the administrative development connection, which bypasses RLS; passing server ownership tests does not prove RLS tenant isolation or production authentication. A restricted application credential and verified login must precede exposing database-backed routes.

## Remaining implementation

- Apply future reviewed migrations without reset or destructive schema synchronization.
- Establish least-privilege application access separately from the administrative migration account. Do not use the current owner connection as the production app credential.
- Keep synthetic fixtures separate from real user data; expand suspended/deleted-user and role-change integration tests.
- Replace fixed demo evidence with database retrieval behind authenticated server access. Keep the offline demo separate.
- Preserve explicit confirmation, transaction/revision safety and idempotency for writes.
- Evaluate English answers against retrieved records, including missing evidence and adversarial follow-ups. No claim of complete factual accuracy yet.

Connection settings do not automatically enforce tenant isolation. Database roles, RLS where applicable, and server authorization must be tested before real records are introduced.
