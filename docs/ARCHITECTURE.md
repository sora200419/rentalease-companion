# Architecture decisions

Current development decisions and deferred integrations, updated 2026-10-08.

The `/companion` prototype uses the [local session service](LOCAL-SERVER.md): synthetic records, file-backed state and a server-held demo role. Its optional Ollama adapter has been evaluated with qwen3:4b; [known limitations](LOCAL-MODEL.md) remain. The independent `/demo` walkthrough, started by the same `npm run dev:companion` launcher, uses bundled synthetic records, isolated file-backed sessions in `.local-runtime/judge-sessions/` and the same pure action validation as records; see [INDEPENDENT-DEMO.md](INDEPENDENT-DEMO.md). The separate `/records` workspace uses NextAuth credential sessions, Prisma and Supabase PostgreSQL with synthetic development accounts. These workspaces do not share business state; demo actors never authorize database access.

Both development modes bind to loopback, skip inherited admin bootstrap and block unrelated inherited APIs. In these modes `/` redirects to `/guide` instead of the inherited `/login`. The records mode checks the host and write origin. They are not suitable for public deployment.

## Retain the working foundation

Keep Next.js, React, TypeScript, PostgreSQL/Prisma, and the existing account model. Runtime tenant/landlord permissions remain server-enforced. Do not replace these systems solely to add more technology names.

## Separate AI requests from business authority

A limited dialogue router selects an available action; optional local AI in records selects source IDs only, and the server quotes exact source text. In `/demo`, the optional Amazon Bedrock assistant writes its own answer text from MCP tool results; its cited source IDs are filtered to real records, and it can only draft through `prepare_dispute_action` (see below). Each read rechecks the active account and tenancy ownership. Signed, expiring, actor-bound previews require explicit confirmation before restricted database functions enforce fixture scope, revisions and idempotency. Arbitrary table updates/deletes remain denied.

Records conversation and selected tenancy/item are account-scoped in sessionStorage. Refresh restores browser context but reloads authoritative data and drops unconfirmed previews. Cross-device conversation history is not implemented. Integer-sen calculations distinguish proposed, disputed, accepted and withdrawn deductions; a proposed new amount is not applied until the tenant accepts it.

The read-only settlement summary warns about inconsistent amounts/status instead of claiming completion. Its authenticated download rereads the latest snapshot and includes dated decisions and file references. It embeds no files, modifies no records and is not a payment receipt. Downloaded copies are outside the application's access control.

## Demo voice assistant (2026-10-08)

The `/demo` **Ask RentalEase** card is the Alexa+ track's simulated experience. Voice runs in the browser through the Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition` for input, `speechSynthesis` for replies). It is not Alexa and uses no Amazon voice service. Typed questions, spoken questions and suggestion chips take the same server path:

```
browser voice / chip / text
  -> POST /api/judge/assistant {revision, question}
  -> assistantTurn
       rule mode (default, no cloud keys): deterministic rule assistant
       Bedrock (only if COMPANION_BEDROCK_MODEL is set):
         in-process MCP client (SDK InMemoryTransport)
           <-> createRecordsMcpServer(case:role, demo services, JUDGE_PROFILE)
         Amazon Bedrock Converse tool loop (at most 5 tool rounds, 30 s deadline)
  -> recordAssistantTurn: a validated draft becomes the existing "Check before saving" preview
  -> the person presses Confirm and save -> POST /api/judge/confirm
```

- The model reads the case only through the six MCP tools that external clients use at `/api/mcp`, as the role that asked. The in-process path uses no HTTP or bearer token. The demo profile's business rules (`validateWorkflowAction`) and role limits still apply.
- A draft is kept only when the person's message asked for a decision; otherwise it is dropped with a note. `recordAssistantTurn` then sends it through the same select and prepare commands a person uses. It never confirms, and the preview expires after five minutes. The model never changes a recorded amount: an amount inside a draft (such as a landlord's revised offer) changes nothing until the person confirms it, and a revised amount still applies only after the tenant accepts it.
- Any Bedrock error, malformed tool use or the process-local cost guard (2 concurrent turns per process, 40 per case per hour; not a billing control) falls back to the rule assistant, and the page notice says so. The server logs the error name and message.

Setup, model IDs, safety rules and verification are in [VOICE-ASSISTANT.md](VOICE-ASSISTANT.md). The Bedrock path has been verified only against a local mock Converse server, not a live AWS account.

## AI provider boundary

The `/demo` assistant has an optional Amazon Bedrock adapter (Converse API, `@aws-sdk/client-bedrock-runtime` 3.1147.0, loaded lazily on the server). It is off unless `COMPANION_BEDROCK_MODEL` is set; credentials come from the standard AWS chain or `AWS_BEARER_TOKEN_BEDROCK` and are never sent to the browser. Tool schemas are flattened for Amazon Nova, which documents only `type`/`properties`/`required` at the top level of a Converse tool schema; the MCP server still validates the exact schema. As of 2026-10-08 this adapter has not been called against a live AWS account, so source accuracy, tool selection, latency and observed cost on a real model remain unevaluated.

The records workspace keeps its optional local Ollama adapter. Inherited code still uses `@google/generative-ai`; if retaining Gemini, migrate to the supported Google GenAI SDK in a separate change. Bedrock was added beside these integrations, not in place of them.

## Private evidence, separate previews

The companion now preserves PNG/JPEG/PDF originals and SHA-256 in private Supabase Storage. Uploads and deduction links require confirmation. A server-authorized no-store route checks the original hash before download or image preview; storage keys remain server-side. Separate resized previews are future work. The inherited Cloudinary and blockchain helpers are not part of this evidence path. Public S3/IPFS links are not used for tenant documents or interior photos. See [PRIVATE-EVIDENCE.md](PRIVATE-EVIDENCE.md).

## Anchoring is an auxiliary verification feature

Optional future work could reuse the Sepolia anchoring concept with durable retry/confirmation state. The companion has not implemented this integration. The imported helper returns a broadcast transaction hash; that alone does not verify a document. Hash equality does not prove truth, legal validity, or damage liability.

A specialized evidence-registry contract and optional wallet signatures can be evaluated after the core demo. RentalEase's ordinary users should continue using their existing accounts.

## Scope and verification

Test unauthorized cross-record access, missing/conflicting evidence, duplicate requests, stale confirmations, and monetary state changes before the demo. Use a separate development database and test-only service accounts. Keep uploads, secrets, and production records outside Git.

The records mode now hosts a local MCP Streamable HTTP endpoint using the official SDK. Its six tools bind identity to the records session and reuse authorized retrieval and action validation. The web conversation calls MCP at runtime; preparation returns a read-only draft without a confirmation token. Human confirmation remains in the existing records form. See [MCP.md](MCP.md).

Since 2026-10-08 the independent demo serves the same six tools at `http://127.0.0.1:3030/api/mcp` through the same server factory with a demo profile. It authenticates per-case, per-role bearer tokens shown on the demo page, accepts deduction decisions only in `prepare_dispute_action`, and offers no confirm, payment, SQL or URL tool. The `/api/judge` browser routes still reject `Authorization` headers.

Formal Alexa+ account linking/runtime, remote MCP OAuth and AWS hosting remain deferred. Voice is a browser simulation, not an Alexa integration. Bedrock is an optional model call made from the local server; nothing is hosted on AWS, and no live Bedrock call has been tested. Current presentation uses the simulated web-experience path with local MCP tools. Before public use, review authentication/revocation, rate limits, production permissions, storage, logging, retention, and broader adversarial/model evaluations.
