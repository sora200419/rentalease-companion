# RentalEase local MCP service

The records workspace hosts a real MCP endpoint at `http://127.0.0.1:3031/api/mcp`. It uses the official TypeScript SDK, pinned to `1.30.1`, with the `2025-11-25` protocol and stateless Streamable HTTP with JSON responses. A standard SDK client performs initialization, sends the initialized notification, discovers tools and calls them. GET returns 405 because this service does not offer an SSE notification stream. JSON-RPC batches are rejected.

This is a local development adapter over the existing synthetic Supabase records. It is not a live Alexa+ Add-on, an Amazon voice service, a public OAuth MCP resource server, or an AWS deployment. No AWS credentials or paid model are needed to run it.

## Run and verify

On the configured development machine:

```sh
npm ci
npm run dev:records
```

Sign in at `http://127.0.0.1:3031/records` with an assigned development account. The existing ignored `.env.records.local` and test accounts are required for database mode. Never place those files in a public repository or deployment bundle.

In **Find a way forward**, ask `Show evidence for the second deduction`. The browser's MCP client calls `ask_records`, checks the returned revision, and displays exact source text and references. Choose a form action and click **Review action** to call `prepare_dispute_action`. A separate existing application endpoint then creates the signed review token. **Confirm and save** is a human-operated application control, not an MCP tool.

```sh
npm run test:mcp
node --use-system-ca scripts/test-records-http.mjs
```

The first command runs without credentials, a database, a model or AWS. It uses the official SDK client with the actual HTTP request/response adapter and in-memory synthetic service inputs. The second runs the SDK client over real loopback HTTP against the four existing development accounts. It queries and previews only, checks unchanged record revisions and tests access after sign-out. The existing full workflow tests continue to cover signed confirmation, expiry and idempotency.

## Exposed tools

| Tool | Result |
| --- | --- |
| `list_tenancies` | Tenancies authorized for the signed-in account; no caller-supplied identity |
| `get_settlement_context` | Current revision, integer-sen amounts, item progress, pending proposals and available actions |
| `get_deduction_evidence` | Published source notes and filenames linked to one deduction |
| `get_agreement` | Complete recorded agreement text and status, without claiming clause relevance or legal interpretation |
| `ask_records` | Limited source-based question answering with optional deduction context |
| `prepare_dispute_action` | Validated read-only draft and amount impact; requires the expected revision |

All tools are read-only, including preparation. There is no `confirm_dispute_action`, payment, SQL, file-fetch or general URL-fetch tool. A preview issues neither a signing token nor storage credentials. It never appends an event. Amount inconsistencies block amount-changing previews, while users can still dispute, reply or refuse and see a warning.

## Identity and confirmation boundaries

- Every HTTP request verifies the existing records login session. Each data operation rechecks current account status and tenancy ownership through the existing database service.
- Role and actor ID are never tool arguments. Strict schemas reject extra fields, malformed targets and unsupported actions.
- The endpoint permits only the loopback Host, validates any supplied Origin, rejects cross-site browser requests and limits request bodies to 24 KB. It is disabled outside records mode. Results are not cached.
- The browser uses its HttpOnly session cookie. Native local clients need their own authenticated records session; the integration test demonstrates this without printing cookies. A separate JWT verifier and remote adapter are tested offline but remain unmounted; standard remote OAuth account linking has not been implemented.
- Published notes, clauses and filenames are untrusted source data. Tools quote them; they are not executable instructions. No photo analysis, legal finding or payment is inferred.
- The MCP preview and the application's signed review must match the displayed revision. Database confirmation still atomically checks the current revision, actor, action, scope and idempotency. Refresh drops unconfirmed previews; stale signed tokens cannot alter current records.

## Local traffic and timeout protection

The local adapter now bounds traffic independently of the tool schemas:

- At most eight MCP requests run concurrently per process, including authentication; authenticated POST requests also have a two-request concurrent limit per account.
- Each account gets a 30-request burst allowance, refilled at two requests per second. Initialization and notifications count as requests, not just tool calls. Rejected traffic receives `429` (account limit) or `503` (service capacity), `Retry-After`, and `Cache-Control: no-store`.
- Quotas use the authenticated account, never a submitted actor, an IP header or a client-chosen session ID. Account buckets are capped at 1,024 and expire when inactive and fully refilled. No message text, passwords or cookies are stored in the limiter.
- A POST body has a five-second reading deadline and a 24,000-byte limit measured from the actual stream, including multibyte text. Oversized declarations, malformed UTF-8, cancelled streams and legacy JSON-RPC batches are rejected before a tool runs.
- The browser gives the whole MCP initialization-and-tool sequence 20 seconds, aborts its network requests when it expires, refuses redirects and does not automatically retry operations. Capacity, timeout and sign-in errors use plain English instead of raw protocol responses.
- An `Authorization` header is rejected in this cookie-only development adapter. Do not send AWS, Supabase service-role or other bearer keys to it.

These are process-local development protections. Restarting clears quotas; multiple server processes would need a shared limiter. The client deadline is not a database-query cancellation mechanism: a read already running may finish on the backend, but MCP has no write capability. These controls are not a cloud cost cap, production availability guarantee or replacement for remote OAuth.

`tests/mcp-hardening.test.mjs` exercises real adapter/client code with bounded synthetic streams and fake authenticated services. It covers quota recovery, account isolation, capacity cleanup, slow/aborted requests and both initialization and tool-call deadlines, without contacting a database or AWS.

## Next deployment steps

Before connecting a remote client or AWS deployment, complete managed OAuth integration, consent/account linking, deployment-specific policy, distributed limits and secret management. The JWT/resource/scope validation core and metadata adapter are now offline-tested, but are not connected to a provider or mounted as routes. Do not expose the cookie-based development adapter through a public tunnel. The staged acceptance plan is in [MCP-REMOTE-PLAN.md](MCP-REMOTE-PLAN.md); it does not enable remote access. [ALEXA-ACCESS.md](ALEXA-ACCESS.md) records the official participant-access restriction checked on 2026-09-28.

AWS credit redemption, its eligible service list and a small spending budget must be checked before cloud resources or model calls are enabled. Budget alerts are notifications, not an automatic spending stop. Deployment and Alexa+ developer access are separate milestones; local protocol interoperability does not establish approval or live Alexa+ integration.

References: [MCP Streamable HTTP](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports), [official TypeScript SDK](https://ts.sdk.modelcontextprotocol.io/server), [hackathon rules](https://amazonappdev2026.devpost.com/rules).
