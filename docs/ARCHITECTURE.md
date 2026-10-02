# Architecture decisions

Current development decisions and deferred integrations, updated 2026-09-26.

The `/companion` prototype uses the [local session service](LOCAL-SERVER.md): synthetic records, file-backed state and a server-held demo role. Its optional Ollama adapter has been evaluated with qwen3:4b; [known limitations](LOCAL-MODEL.md) remain. The separate `/records` workspace uses NextAuth credential sessions, Prisma and Supabase PostgreSQL with synthetic development accounts. These workspaces do not share business state; demo actors never authorize database access.

Both development modes bind to loopback, skip inherited admin bootstrap and block unrelated inherited APIs. The records mode checks the host and write origin. They are not suitable for public deployment.

## Retain the working foundation

Keep Next.js, React, TypeScript, PostgreSQL/Prisma, and the existing account model. Runtime tenant/landlord permissions remain server-enforced. Do not replace these systems solely to add more technology names.

## Separate AI requests from business authority

A limited dialogue router selects an available action; optional local AI in records selects source IDs only. The server quotes exact source text. Each read rechecks the active account and tenancy ownership. Signed, expiring, actor-bound previews require explicit confirmation before restricted database functions enforce fixture scope, revisions and idempotency. Arbitrary table updates/deletes remain denied.

Records conversation and selected tenancy/item are account-scoped in sessionStorage. Refresh restores browser context but reloads authoritative data and drops unconfirmed previews. Cross-device conversation history is not implemented. Integer-sen calculations distinguish proposed, disputed, accepted and withdrawn deductions; a proposed new amount is not applied until the tenant accepts it.

The read-only settlement summary warns about inconsistent amounts/status instead of claiming completion. Its authenticated download rereads the latest snapshot and includes dated decisions and file references. It embeds no files, modifies no records and is not a payment receipt. Downloaded copies are outside the application's access control.

## AI provider boundary

The imported code uses `@google/generative-ai`. If retaining Gemini, migrate to the supported Google GenAI SDK in a separate change. Evaluate Bedrock using the same small set of task scenarios before choosing the primary provider. Compare source accuracy, tool selection, latency, and observed cost. Do not replace existing integrations during repository initialization.

## Private evidence, separate previews

The companion now preserves PNG/JPEG/PDF originals and SHA-256 in private Supabase Storage. Uploads and deduction links require confirmation. A server-authorized no-store route checks the original hash before download or image preview; storage keys remain server-side. Separate resized previews are future work. The inherited Cloudinary and blockchain helpers are not part of this evidence path. Public S3/IPFS links are not used for tenant documents or interior photos. See [PRIVATE-EVIDENCE.md](PRIVATE-EVIDENCE.md).

## Anchoring is an auxiliary verification feature

Optional future work could reuse the Sepolia anchoring concept with durable retry/confirmation state. The companion has not implemented this integration. The imported helper returns a broadcast transaction hash; that alone does not verify a document. Hash equality does not prove truth, legal validity, or damage liability.

A specialized evidence-registry contract and optional wallet signatures can be evaluated after the core demo. RentalEase's ordinary users should continue using their existing accounts.

## Scope and verification

Test unauthorized cross-record access, missing/conflicting evidence, duplicate requests, stale confirmations, and monetary state changes before the demo. Use a separate development database and test-only service accounts. Keep uploads, secrets, and production records outside Git.

The records mode now hosts a local MCP Streamable HTTP endpoint using the official SDK. Its six tools bind identity to the records session and reuse authorized retrieval and action validation. The web conversation calls MCP at runtime; preparation returns a read-only draft without a confirmation token. Human confirmation remains in the existing records form. See [MCP.md](MCP.md).

Formal Alexa+ account linking/runtime, remote MCP OAuth, AWS hosting/Bedrock and voice remain deferred. Current presentation uses the simulated web-experience path with local MCP tools. Before public use, review authentication/revocation, rate limits, production permissions, storage, logging, retention, and broader adversarial/model evaluations.
