# RentalEase local MCP service

RentalEase has one MCP server implementation, served at two local endpoints. Both use the official TypeScript SDK, pinned to `1.30.1`, with the `2025-11-25` protocol and stateless Streamable HTTP with JSON responses. A standard SDK client performs initialization, sends the initialized notification, discovers tools and calls them. GET returns 405 because this service does not offer an SSE notification stream. JSON-RPC batches are rejected.

Neither endpoint is a live Alexa+ Add-on, an Amazon voice service, a public OAuth MCP resource server, or an AWS deployment. Both accept loopback requests only. No AWS credentials or paid model are needed to run either endpoint.

## Two local MCP endpoints

| | Independent demo | Records workspace |
| --- | --- | --- |
| Start | `npm run dev:companion` | `npm run dev:records` |
| Endpoint | `http://127.0.0.1:3030/api/mcp` | `http://127.0.0.1:3031/api/mcp` |
| Data | One synthetic case per browser, stored locally | Existing synthetic development records in Supabase |
| Authentication | Per-case, per-role bearer token | Records login session cookie; an `Authorization` header is rejected |
| Credentials needed | None | Ignored `.env.records.local` and assigned development accounts |
| `prepare_dispute_action` | Deduction decisions only, checked against the demo's business rules | Report or decision, checked against the existing fixture guards |

In any other mode `/api/mcp` returns 404. The demo endpoint was added on 2026-10-08.

## Demo endpoint: run and connect

```sh
npm ci
npm run dev:companion
```

Open `http://127.0.0.1:3030/demo` and start a scenario. Open **Connect an MCP client to this case** for the server URL, the bearer token for the role currently shown, and copyable client snippets. Switch roles on the page for the other role's token. The page fetches these details from the cookie-authenticated `GET /api/judge/mcp`. Treat a token like a password.

### Client recipes

Replace `TOKEN` with the token from the page and use the exact `127.0.0.1` address.

MCP Inspector CLI (Inspector 2.x needs Node.js 22.19 or later):

```sh
npx -y @modelcontextprotocol/inspector --cli http://127.0.0.1:3030/api/mcp --transport http --header "Authorization: Bearer TOKEN" --method tools/list
```

Without a token, Inspector 2.9.0 attempts interactive OAuth and fails with "Interactive OAuth requires a TTY" rather than reporting the plain 401.

Claude Code:

```sh
claude mcp add --transport http rentalease-demo http://127.0.0.1:3030/api/mcp --header "Authorization: Bearer TOKEN"
```

Claude Desktop, in `claude_desktop_config.json`, through `mcp-remote`:

```json
{
  "mcpServers": {
    "rentalease-demo": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "http://127.0.0.1:3030/api/mcp", "--transport", "http-only", "--header", "Authorization:${AUTH_HEADER}"],
      "env": { "AUTH_HEADER": "Bearer TOKEN" }
    }
  }
}
```

There is deliberately no space after `Authorization:` because of a Windows argument-escaping issue. Restart Claude Desktop after editing the file. Claude Desktop's cloud Connectors UI cannot reach `127.0.0.1`, so use the local configuration file.

### Token model

- Each case has one tenant token and one landlord token: `rle_demo_` followed by 43 base64url characters (32 random bytes).
- The token's role is fixed. A tenant token cannot preview landlord decisions, whatever role the browser currently shows.
- Tokens are stored in the case file. An index file named by the token's SHA-256 hash lives in `.local-runtime/judge-sessions/mcp-tokens/`.
- Tokens follow the browser to a newly started scenario; the previous case stops answering. They stop working when the case expires after 7 days.
- Requests must use Host `127.0.0.1:3030`. An `Origin` header, if present, must be `http://127.0.0.1:3030`; native clients send none. Cross-site browser requests are rejected.
- A missing, malformed or unknown token receives 401 with `WWW-Authenticate: Bearer`.
- A token unlocks only the six read-only MCP tools. The `/api/judge` browser routes still reject `Authorization` headers, and saving still needs **Confirm and save** on the demo page.
- The demo uses the same process-local body and rate limits as the records adapter, keyed by the token's case and role instead of a records account.

### Verification — 2026-10-08

- The official MCP Inspector CLI 2.9.0 ran `tools/list` (six tools) and `tools/call ask_records` against the live demo endpoint.
- `npm run test:demo:http` runs an MCP SDK client over real loopback HTTP against the demo.
- `tests/judge-mcp.test.mjs` covers token stability, carry-over to a new scenario, expiry, Host/Origin/bearer checks, role-limited previews and reads that reflect browser-confirmed decisions. It runs in `npm test` and `npm run test:mcp`.
- Not verified here: the Claude Code command was not executed. The Claude Desktop recipe (`mcp-remote` 0.14.3) was exercised during development against an equivalent local bearer-token server, not against this endpoint inside a real Claude Desktop install.

## The demo assistant uses the same server in-process

Typed and spoken questions on `/demo` go to `POST /api/judge/assistant`. By default the deterministic rule assistant answers, with no cloud keys. If the person running the demo sets `COMPANION_BEDROCK_MODEL`, an optional Amazon Bedrock model (Converse API) answers instead. It reads the case only through the RentalEase MCP tools: an in-process SDK client (`InMemoryTransport`) connects to the same server factory with the demo profile, as the role asking, then lists and calls the tools. This path does not use HTTP or a bearer token.

MCP role and business rules still apply. The model cannot save; drafts go through `prepare_dispute_action` and become the ordinary **Check before saving** preview only when the person asked for a decision. Only the person pressing **Confirm and save** records a decision. On any Bedrock error the rule assistant answers and the page says so.

The Bedrock path was verified on 2026-10-08 only against a local mock Converse server (`scripts/mock-bedrock.mjs`), not a live AWS account. Setup, model IDs, safety rules and the browser voice simulation are documented in [VOICE-ASSISTANT.md](VOICE-ASSISTANT.md).

## Records workspace: run and verify

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

Both endpoints expose the same six tools.

| Tool | Result |
| --- | --- |
| `list_tenancies` | Tenancies authorized for the signed-in account (or, in the demo, the token's case); no caller-supplied identity |
| `get_settlement_context` | Current revision, integer-sen amounts, item progress, pending proposals and available actions |
| `get_deduction_evidence` | Published source notes and filenames linked to one deduction |
| `get_agreement` | Complete recorded agreement text and status, without claiming clause relevance or legal interpretation |
| `ask_records` | Limited source-based question answering with optional deduction context |
| `prepare_dispute_action` | Validated read-only draft and amount impact; requires the expected revision |

All tools are read-only, including preparation. There is no `confirm_dispute_action`, payment, SQL, file-fetch or general URL-fetch tool. A preview issues neither a signing token nor storage credentials. It never appends an event. Amount inconsistencies block amount-changing previews, while users can still dispute, reply or refuse and see a warning. In the demo, `prepare_dispute_action` accepts deduction decisions only (no `REPORT` kind).

## Identity and confirmation boundaries

These points describe the records workspace; the demo's token model is described above.

- Every HTTP request verifies the existing records login session. Each data operation rechecks current account status and tenancy ownership through the existing database service.
- Role and actor ID are never tool arguments. Strict schemas reject extra fields, malformed targets and unsupported actions. This also applies to the demo.
- The endpoint permits only the loopback Host, validates any supplied Origin, rejects cross-site browser requests and limits request bodies to 24 KB. Cookie authentication is used only in records mode; the demo endpoint uses bearer tokens instead. Results are not cached.
- The browser uses its HttpOnly session cookie. Native local clients need their own authenticated records session; the integration test demonstrates this without printing cookies. To try a native client without credentials, use the demo endpoint. A separate JWT verifier and remote adapter are tested offline but remain unmounted; standard remote OAuth account linking has not been implemented.
- Published notes, clauses and filenames are untrusted source data. Tools quote them; they are not executable instructions. No photo analysis, legal finding or payment is inferred.
- The MCP preview and the application's signed review must match the displayed revision. Database confirmation still atomically checks the current revision, actor, action, scope and idempotency. Refresh drops unconfirmed previews; stale signed tokens cannot alter current records.

## Local traffic and timeout protection

The local adapter now bounds traffic independently of the tool schemas. The demo endpoint shares these limits.

- At most eight MCP requests run concurrently per process, including authentication; authenticated POST requests also have a two-request concurrent limit per account.
- Each account gets a 30-request burst allowance, refilled at two requests per second. Initialization and notifications count as requests, not just tool calls. Rejected traffic receives `429` (account limit) or `503` (service capacity), `Retry-After`, and `Cache-Control: no-store`.
- Quotas use the authenticated account, never a submitted actor, an IP header or a client-chosen session ID. Account buckets are capped at 1,024 and expire when inactive and fully refilled. No message text, passwords or cookies are stored in the limiter.
- A POST body has a five-second reading deadline and a 24,000-byte limit measured from the actual stream, including multibyte text. Oversized declarations, malformed UTF-8, cancelled streams and legacy JSON-RPC batches are rejected before a tool runs.
- The browser gives the whole MCP initialization-and-tool sequence 20 seconds, aborts its network requests when it expires, refuses redirects and does not automatically retry operations. Capacity, timeout and sign-in errors use plain English instead of raw protocol responses.
- An `Authorization` header is rejected by the cookie-only records adapter. The demo endpoint accepts only its own `rle_demo_` tokens. Do not send AWS, Supabase service-role or other bearer keys to either endpoint.

These are process-local development protections. Restarting clears quotas; multiple server processes would need a shared limiter. The client deadline is not a database-query cancellation mechanism: a read already running may finish on the backend, but MCP has no write capability. These controls are not a cloud cost cap, production availability guarantee or replacement for remote OAuth.

`tests/mcp-hardening.test.mjs` exercises real adapter/client code with bounded synthetic streams and fake authenticated services. It covers quota recovery, account isolation, capacity cleanup, slow/aborted requests and both initialization and tool-call deadlines, without contacting a database or AWS.

## Next deployment steps

Before connecting a remote client or AWS deployment, complete managed OAuth integration, consent/account linking, deployment-specific policy, distributed limits and secret management. The JWT/resource/scope validation core and metadata adapter are now offline-tested, but are not connected to a provider or mounted as routes. The demo's local bearer tokens are not OAuth and are not a remote access mechanism. Do not expose either development endpoint through a public tunnel. The staged acceptance plan is in [MCP-REMOTE-PLAN.md](MCP-REMOTE-PLAN.md); it does not enable remote access. [ALEXA-ACCESS.md](ALEXA-ACCESS.md) records the official participant-access restriction checked on 2026-09-28.

No cloud resources are created by this repository. The optional Bedrock assistant calls a model only when the person running the demo configures their own AWS credentials and `COMPANION_BEDROCK_MODEL`. Before doing so, check AWS credit redemption, its eligible service list, model pricing and a small spending budget. Budget alerts are notifications, not an automatic spending stop, and the assistant's per-case hourly limit is a process-local guard, not a billing control. Deployment and Alexa+ developer access are separate milestones; local protocol interoperability does not establish approval or live Alexa+ integration.

References: [MCP Streamable HTTP](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports), [official TypeScript SDK](https://ts.sdk.modelcontextprotocol.io/server), [hackathon rules](https://amazonappdev2026.devpost.com/rules).
