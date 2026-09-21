# Architecture decisions

These are development decisions and proposals, not claims that integrations already exist.

The `/companion` prototype now uses the [local session service](LOCAL-SERVER.md): synthetic records, file-backed state and a server-held demo role. An optional Ollama adapter is tested with controlled responses, not a real model. Prisma and real account authentication are not yet connected; demo actors must never be accepted as production authorization.

## Retain the working foundation

Keep Next.js, React, TypeScript, PostgreSQL/Prisma, and the existing account model. Runtime tenant/landlord permissions remain server-enforced. Do not replace these systems solely to add more technology names.

## Separate AI requests from business authority

The model proposes tool calls. Application services validate the actor, tenancy, referenced evidence, and current state before returning data. Reads expose only the authorized context. Writes additionally require a recorded user confirmation and an idempotency key. Existing pages and new tools should share the same services rather than copy their rules.

Persist a conversation's references and progress, but refresh financial and workflow data from the database. Compute monetary values in deterministic application code. Distinguish proposed, disputed, and accepted deductions.

## AI provider boundary

The imported code uses `@google/generative-ai`. If retaining Gemini, migrate to the supported Google GenAI SDK in a separate change. Evaluate Bedrock using the same small set of task scenarios before choosing the primary provider. Compare source accuracy, tool selection, latency, and observed cost. Do not replace existing integrations during repository initialization.

## Private evidence, separate previews

The existing Cloudinary helpers transform images at upload. For the new evidence flow, preserve original bytes, generate separate display previews, and track the hash of the original. Private S3 is the proposed new evidence store; public listing imagery can remain on Cloudinary. Authorize the user before issuing short-lived object access. Public IPFS is not the default for tenant documents or interior photos.

## Anchoring is an auxiliary verification feature

Reuse the existing Sepolia anchoring concept first. Add durable submission/retry/confirmation state and verify the content hash against a confirmed transaction. The imported helper returns a broadcast transaction hash; that alone does not verify a document. Hash equality does not prove truth, legal validity, or damage liability.

A specialized evidence-registry contract and optional wallet signatures can be evaluated after the core demo. RentalEase's ordinary users should continue using their existing accounts.

## Scope and verification

Test unauthorized cross-record access, missing/conflicting evidence, duplicate requests, stale confirmations, and monetary state changes before the demo. Use a separate development database and test-only service accounts. Keep uploads, secrets, and production records outside Git.
