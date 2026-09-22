# Supabase development connection

The owner's isolated Free project is `rgthmushgkithgkmszsy`. Connection uses the session pooler on port 5432. Data API was disabled during project creation. No paid resources are provisioned by these scripts.

## Local configuration

`.env.supabase.local` is ignored by Git and deliberately not loaded by the application. It contains `SUPABASE_DB_HOST`, `SUPABASE_DB_PORT`, `SUPABASE_DB_NAME`, `SUPABASE_DB_USER` and the raw `SUPABASE_DB_PASSWORD`. Never paste credentials into chat, commit them, or log the assembled URL. The connection helper percent-encodes credentials and rejects a different project target. Changing that target requires a deliberate code review.

Run `npm run db:check:supabase` for a read-only inspection of connection identity and public table metadata. It does not read tenant records or run migrations. Errors omit raw database messages because they may contain credentials. Network access may require local execution approval. Run `npm run test:db-config` for synthetic tests with no network or real password.

## Verified milestone

The initial live check connected successfully as `postgres`, reported `transaction_read_only=on`, and found no tables in the public schema. This does not imply that Supabase's internal schemas are empty. No schema or data was changed. The Companion still uses local file-backed synthetic sessions; database connectivity alone is not application integration.

## Remaining implementation

- Review the inherited schema and migrations before applying any SQL; do not run reset or destructive schema synchronization.
- Establish least-privilege application access separately from the administrative migration account. Do not use the current owner connection as the production app credential.
- Import only synthetic fixtures into the development database, then test authorized tenancy queries and cross-tenant denial.
- Replace fixed demo evidence with database retrieval behind authenticated server access. Keep the offline demo separate.
- Preserve explicit confirmation, transaction/revision safety and idempotency for writes.
- Evaluate English answers against retrieved records, including missing evidence and adversarial follow-ups. No claim of complete factual accuracy yet.

Connection settings do not automatically enforce tenant isolation. Database roles, RLS where applicable, and server authorization must be tested before real records are introduced.
