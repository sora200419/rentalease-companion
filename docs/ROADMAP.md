# MVP backlog

## Demo story

A disputed wall-repair deduction is connected to a move-in record. The tenant checks sources and confirms a response. The landlord reviews and can withdraw the deduction. Both roles see the updated settlement state.

Use synthetic records and clearly labelled demo photographs. Do not imply a record's upload time proves the photo's capture time.

## 1. Reproducible baseline

- [x] Import the existing source without secrets.
- [x] Separate schema migration from production build.
- [x] Document setup, provenance, and planned work.
- [x] Install locked dependencies, generate/validate the schema, and pass the type check.
- [ ] Run the app against an isolated database and test service accounts.
- [ ] Add a repeatable synthetic dataset with tenant and landlord demo roles.
- [ ] Establish targeted tests for record access, settlement calculations, and state transitions.
  - [x] Add 12 offline regression tests for inherited settlement/review transitions and evidence comparison.
  - [ ] Add server authorization, monetary calculation, and database integration tests. Pure helper tests do not prove tenancy access control.

## 2. Evidence retrieval

- [ ] Extract authorized business services from route handlers.
- [ ] Implement `getSettlementContext`, `getDeductionEvidence`, and `getRelevantAgreementClauses`.
- [ ] Return source IDs and status alongside every evidence item.
- [ ] Build evidence cards showing report status, source text, and side-by-side photographs.

Acceptance: cross-tenancy requests fail; missing or disputed baseline evidence remains visible; every factual claim has an available source.

## 3. Assistant and confirmed actions

- [ ] Add a model-provider boundary and migrate the legacy Gemini SDK if Gemini remains in use.
- [ ] Store conversation context; re-read authoritative business state on resume.
- [ ] Add `prepareDispute`, `submitConfirmedDispute`, and `withdrawConfirmedDeduction`.
- [ ] Require an explicit role-bound confirmation for each business write.
- [ ] Make writes idempotent and reject stale confirmations.

Acceptance: a conversation survives refresh; retries do not duplicate a dispute; tenant and landlord actions remain separate; a model cannot approve a deduction itself.

## 4. Evidence integrity and delivery

- [ ] Store original evidence bytes and a separate preview; hash the original.
- [ ] Introduce private object storage and short-lived access issued after authorization.
- [ ] Record on-chain submission, confirmation, failure, and retry state.
- [ ] Compare downloaded evidence/contract bytes with the recorded hash.

Acceptance: a changed file fails verification; a pending transaction is never labelled verified; a missing image does not become an invented observation.

## 5. Presentation and submission

- [ ] Add optional voice input after the text flow works reliably.
- [ ] Record an English demo shorter than three minutes.
- [ ] Provide reproducible judge instructions and documented limitations.
- [ ] Record genuine developer feedback and friction as work happens.
- [ ] Recheck current rules and document AWS usage only if actually integrated.

Out of scope for this MVP: automatic payments, legal adjudication, a complete repair marketplace, public identity documents, tokens, and mandatory tenant wallets.
