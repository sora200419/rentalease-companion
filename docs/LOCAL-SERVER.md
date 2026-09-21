# Local service and optional Ollama integration

## Current milestone

The browser now calls a local Next.js API for evidence, settlement state, chat, drafts and confirmations. It no longer calculates authoritative state or writes the scenario to localStorage. Existing v1 localStorage records are left untouched and are not imported.

`npm run dev:companion` binds to 127.0.0.1:3030, enables the synthetic service, and blocks inherited authentication APIs and dashboards. `/api/companion/*` is disabled outside this mode. This is a demo service, not a production tenancy backend.

## Sessions and storage

Each browser receives a random 256-bit HttpOnly, SameSite=Strict cookie scoped to `/api/companion`. Session files live in `.companion-data/`, ignored by Git. The store serializes read-check-write operations and replaces files atomically. One Node server process must own the directory; it is not a clustered database.

Sessions record the demo role, state, version, role-specific chat history and seven-day expiry. Expired files remain on disk until explicitly cleaned but are no longer accepted. Losing the cookie starts an independent session. Another browser gets another scenario, rather than joining the first browser's tenancy.

The role switch is a simulation feature, not identity verification. Real users will require authenticated sessions and database ownership checks. Never use real tenant information in this service.

## Writes and confirmation

The server accepts only defined command fields. Clients cannot send actor IDs, source text, amounts or arbitrary tenancy state. Commands include the last observed revision; stale requests return 409 and the UI reloads state for review. Only one request per session runs at a time.

Prepared actions have server-generated IDs and expire after five minutes. Confirmations are bound to the session, role, business state and action ID. Retrying a successful confirmation returns the saved result without duplicating activity. Role switches, cancellation and page resume discard pending drafts. Reset creates a fresh synthetic scenario while advancing the revision.

Chat never submits or withdraws a deduction. Users must use the action buttons. A model response cannot invoke business writes.

## Optional local inference

Local Qwen3 4B is now installed and real inference has been exercised on the development computer. This remains experimental: the Chinese evaluation case triggers a safety fallback. See [LOCAL-MODEL.md](LOCAL-MODEL.md) for setup, measurements and unresolved quality findings.

When a local model is available:

1. Run Ollama in local-only mode with `OLLAMA_NO_CLOUD=1` applied to the Ollama process and restart it. Setting this on Next.js does not reconfigure an already-running Ollama server. See [official local-only instructions](https://docs.ollama.com/faq#how-do-i-disable-ollama-cloud-features).
2. Use an already installed local GGUF model. This application does not install Ollama or download model weights. Select a model after checking hardware and disk space.
3. Set `COMPANION_OLLAMA_MODEL` to the exact installed model name in an ignored `.env.local`, then restart the companion server. Leave it empty for rule mode.
4. A successful model response is labelled **COMPANION · LOCAL AI**. The separate **Local AI configured** indicator is not proof of successful inference.

The provider only calls http://127.0.0.1:11434, rejects redirects, requires installed GGUF metadata and rejects cloud names/remote metadata. There is no configurable remote URL, cloud fallback, key, model download or paid API. Also disable cloud features in Ollama itself; a loopback address alone cannot establish how an arbitrary service behaves.

Requests include server records, integer-sen amounts and at most eight recent entries for the active role. [Structured outputs](https://docs.ollama.com/capabilities/structured-outputs) constrain response shape. The app separately validates length, allowed fields, citation IDs and inline references. A 45-second deadline, missing model or invalid output produces a visibly labelled rule response.

Valid JSON and citations do not prove accuracy. Real-model evaluation must check factual errors, incorrect amounts, misleading action claims and prompt injection. The application independently controls state transitions; payments are out of scope.

## Verification (2026-09-22)

- `npm test`: 37 tests cover workflows, persistence, session isolation, concurrent/stale writes, expiry, idempotency, role-specific model context, output validation and fallback.
- `npm run test:companion:http`: requires the dedicated server on port 3030. Creates synthetic sessions and checks cookies, origin rejection, body limits, tampered commands, session isolation, dispute/withdrawal and inherited API blocking. Set `COMPANION_REQUIRE_AI=1` to require an actual model response; this mode was verified.
- Browser verification covered cited chat, tenant confirmation, refreshed history, landlord withdrawal and refund values, without observed console errors.
- Production authentication/database and cloud integrations are not claimed as tested.
