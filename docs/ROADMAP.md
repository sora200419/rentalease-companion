# MVP backlog

## Demo story

A disputed wall-repair deduction is connected to a move-in record. The tenant checks sources and confirms a response. The landlord reviews and can withdraw the deduction. Both roles see the updated settlement state.

Use synthetic records and clearly labelled demo photographs. Do not imply a record's upload time proves the photo's capture time.

## 1. Reproducible baseline

### Completed offline prototype (2026-09-21)

- [x] Add a standalone `/companion` demo with synthetic roles and tenancy records.
- [x] Show cited evidence and labelled room illustrations, including missing/disputed baseline variants.
- [x] Implement rule-based conversation and confirmed, role-bound local actions with stale/retry checks.
- [x] Persist demo progress in one browser; drop pending confirmations on refresh.
- [x] Provide an offline launch mode that blocks inherited backend routes.
- [x] Verify the full demo flow in the browser and add 10 companion domain tests (22 total).

These are fixture-backed prototype features. Completed development integrations below are not a production-readiness claim.

### Completed local service milestone (2026-09-22)

- [x] Move demo state, role selection, evidence and confirmed actions behind a local session API.
- [x] Add file persistence, input/origin checks, revision conflicts, expiry and retry handling.
- [x] Connect the UI to role-specific server history and visible request errors.
- [x] Add an optional local Ollama adapter with validated citations and visible rule fallback.
- [x] Pass 34 tests plus actual HTTP and browser workflow checks.
- [x] Install/select a local model after a hardware review, then evaluate real inference.
- [x] Narrow the release scope to English per owner request; Chinese accuracy is deferred, not fixed.
- [x] Add English follow-up, indirect action, stale amount and history-injection evaluations.
- [ ] Expand adversarial coverage beyond the small synthetic evaluation before claiming submission-ready quality.

The local demo service uses synthetic identities. The separate Supabase records milestone below now checks real credential sessions against synthetic development accounts; production authentication remains open.

### Completed authenticated records milestone (2026-09-22)

- [x] Provision an explicitly approved read-only backend role, separate from migration access.
- [x] Add loopback-only `/records` login, tenancy listing, exact evidence and recorded amounts.
- [x] Verify all four synthetic accounts, cross-tenancy refusal, forbidden writes and sign-out over HTTP.
- [x] Add deterministic English Q&A with fresh authorized retrieval, citations, missing-data and amount-consistency notices.
- [x] Browser-test login and cited refund answers; retain the English cream/green interface.
- [ ] Expand live session-revocation scenarios and production authorization design.
- [x] Add optional local-model source selection on database evidence; render exact quotes only, validate IDs and preserve published baseline context.
- [ ] Broaden source-selection relevance evaluation and real-world datasets; do not conflate quotes with verified findings.

- [x] Import the existing source without secrets.
- [x] Separate schema migration from production build.
- [x] Document setup, provenance, and planned work.
- [x] Install locked dependencies, generate/validate the schema, and pass the type check.
- [x] Run the records workspace against an isolated database and test service accounts.
- [x] Initialize the isolated Supabase development database and verify server-side record retrieval against two synthetic tenancies, now connected to `/records`.
- [x] Add a repeatable synthetic dataset with tenant and landlord demo roles.
- [x] Establish targeted tests for development record access, settlement calculations, and state transitions.
  - [x] Add 12 offline regression tests for inherited settlement/review transitions and evidence comparison.
  - [x] Add HTTP authorization/isolation tests and real database monetary/state-transition integration tests; the resolution suite rolls back its temporary transaction.

## 2. Evidence retrieval

### Confirmed Supabase submissions (2026-09-23)

- [x] Apply owner-approved, fixture-scoped submission function; keep arbitrary table writes and deletes denied.
- [x] Add signed, expiring, actor-bound previews and explicit confirmation.
- [x] Persist submitted text reports, tenant disputes and landlord replies with append-only history.
- [x] Verify concurrent idempotency, stale revisions, cross-tenancy/role checks and unchanged amounts with live integration tests.
- [x] Add private photo/file storage, replies, withdrawals, revised-amount proposals, tenant acceptance/rejection, and independent multi-item settlement resolution. Replies alone do not resolve disputes.

- [ ] Extract authorized business services from route handlers.
- [x] Add authorized MCP settlement context and deduction evidence tools, plus complete agreement-source retrieval.
- [ ] Evaluate relevant-clause selection; the current agreement tool quotes the complete source, not inferred relevance.
- [x] Return source IDs and status alongside records-workspace evidence; show deduction-specific saved file references.
- [x] Build evidence cards showing report status, source text, and selected-item side-by-side photographs.
- [x] Stage four full-size, visibly labelled AI-generated demo photographs with provenance and prompts outside public assets.

Acceptance: cross-tenancy requests fail; missing or disputed baseline evidence remains visible; every factual claim has an available source.

## 3. Assistant and confirmed actions

- [x] Add a local MCP `2025-11-25` Streamable HTTP service and an actual web SDK client for questions and read-only previews.
- [x] Keep signing tokens and database confirmation outside the MCP tool surface; validate actor, role, targets and revision.
- [x] Bound local MCP request concurrency, per-account bursts, body size/read time and browser wait time; test recovery and no automatic retry.
- [x] Implement an offline-tested remote JWT access-token verifier, scope-aware MCP adapter, resource metadata and per-request grant/revocation checks; keep the adapter unmounted and disabled.
- [x] Verify the official Alexa+ access boundary: the hackathon FAQ offers no participant access to the gated partner tools; local simulation is an accepted route (2026-09-28).
- [ ] Configure a managed OAuth provider, explicit consent/account-linking flow and persistent revocation storage; validate PKCE/refresh with a real provider before approved remote hosting.

- [ ] Add a model-provider boundary and migrate the legacy Gemini SDK if Gemini remains in use.
- [x] Store account/tenancy-scoped conversation and selected item for the browser session; re-read authoritative state on reload. Cross-device conversation history remains out of scope.
- [x] Implement prepare/confirm operations for disputes, withdrawals, replies and revised amounts through restricted database functions.
- [x] Require explicit role-bound confirmation for each records-workspace business write and private upload/reference.
- [x] Make confirmed actions idempotent and reject stale or expired confirmations.

Acceptance: a conversation survives refresh; retries do not duplicate a dispute; tenant and landlord actions remain separate; a model cannot approve a deduction itself.

## 4. Evidence integrity and delivery

- [x] Preserve original evidence bytes and SHA-256; preview verified PNG/JPEG originals through an authenticated no-store route. Separate resized previews remain optional.
- [x] Introduce private object storage; authorize each proxied read rather than issuing public links. Production storage review remains open.
- [ ] Optional future work: on-chain submission, confirmation, failure, and retry state. Not required for the dispute MVP.
- [x] Verify downloaded and previewed evidence bytes against the content hash. Contract-byte verification remains separate future work.

Acceptance: a changed file fails verification; a pending transaction is never labelled verified; a missing image does not become an invented observation.

## 5. Presentation and submission

- [x] Add an independent three-item demo with bundled synthetic evidence, isolated file persistence and role-switched complete dispute resolution; no private database credentials.
- [x] Add regressions for named/word-numbered targets, multi-intent clarification, exact proposal amounts and disputed counter-accounts.
- [x] Complete the new independent demo's browser workflow and 320/390/760/1280px responsive QA (2026-09-29; keyboard/form interaction, not physical-device certification).
- [x] Verify a clean local candidate without environment files: locked installation, 209 tests, production build and standalone HTTP workflow (2026-09-29). Remote GitHub clone parity remains a delivery check.

- [ ] Add optional voice input after the text flow works reliably.
- [ ] Record an English demo shorter than three minutes.
- [x] Add a read-only item-progress summary and authenticated current-snapshot text export with source references.
- [x] Provide a mode-aware in-app demo guide, reproducible local judge instructions and documented limitations.
- [x] Prepare an English Devpost draft and timed demo script; owner review and actual recording remain pending.
- [x] Record observed local-model friction; no Amazon runtime/SDK testing is claimed.
- [x] Recheck the official Alexa+ simulated web-experience alternative on 2026-09-26; no AWS integration is claimed.
- [ ] Agree source access/licensing and safe remote judge access before final submission; do not publish the development credentials.

Out of scope for this MVP: automatic payments, legal adjudication, a complete repair marketplace, public identity documents, tokens, and mandatory tenant wallets.
