# Independent three-item demonstration

## Run without private credentials

Use Node.js 22. Install locked dependencies with `npm ci`, then run `npm run dev:companion`. Open **http://127.0.0.1:3030/demo** or start from `/guide`.

No environment file, Supabase account, AWS credit, model download or cloud service is required for this demonstration. Dependency installation itself needs the npm registry. Do not run database setup or migrations to use this mode. The launcher binds to loopback, explicitly disables records mode, skips admin bootstrap and blocks inherited backend APIs.

This is the Alexa+ **simulated web experience**, not an official Alexa+ connection. The independent demo uses the same pure action validation, dialogue routing and evidence-answer rules as the records workspace; it does not claim a live MCP or Alexa connection. The separate records workspace retains its MCP adapter.

## A complete walkthrough

1. Start the standard scenario as **Tenant · Aina**. Deposit: MYR 1,800; proposed deductions: wall MYR 100, cleaning MYR 50, key MYR 25. Current refund: MYR 1,625.
2. Choose wall. Ask “Show evidence for the first deduction.” Read both report statuses and open W01/W02. All photographs visibly say **AI-GENERATED DEMO — NOT REAL EVIDENCE**.
3. Choose **Dispute this deduction**, enter your reason, and preview. **Cancel preview**: no settlement event is saved. Prepare again, then **Confirm and save**.
4. Select cleaning and confirm a separate dispute. Switch to **Landlord · Daniel** and reply. Switch back to tenant and reject the reply. Rejection keeps the dispute open.
5. As landlord, propose MYR 30 for cleaning. As tenant, reject the proposal. As landlord, propose MYR 20; as tenant, accept the revised amount. The new amount only takes effect at tenant confirmation.
6. As tenant, accept the key deduction. As landlord, withdraw the wall deduction. Each action has its own preview and confirmation.
7. Confirm that all three items are resolved, the refund is MYR 1,755, and history retains the rejected reply/proposal and original amounts. **AGREED does not mean PAID**.
8. Refresh. Saved history, selected item, role and role-specific conversations remain; unconfirmed previews are discarded.

The role selector is deliberately a simulation, not identity authentication. Two browsers have separate cases. Use the same browser to switch roles within one case.

## Conversation accuracy checks

- “Accept the second deduction and dispute the first” asks which item to review first. It does not execute either decision.
- “Accept the cleaning deduction” selects cleaning even if wall was previously selected.
- “Accept the first deduction for cleaning” is contradictory and asks for clarification.
- “Accept item two” recognizes the item number. “Accept the last deduction” asks for an explicit number/name.
- “Propose a lower amount”, ranges, multiple prices and unsupported currencies do not infer an amount.
- Questions, conditional decisions, quoted instructions and negated refusals do not become confirmations.
- “Who is responsible?” does not produce a liability finding.

This is conservative English rule matching, not unrestricted language understanding. Chinese multi-item examples are tested for safe refusal, not advertised as a Chinese-language UI or conversational capability. Use the explicit action menu when a phrase is unsupported. Each message discards any earlier unconfirmed preview.

## Missing and conflicting evidence

**Start another scenario** opens a separate confirmation panel.

- **Missing** omits the move-in report and move-in photos, including their file endpoints. The answer names the missing baseline; it does not infer condition from absence.
- **Conflicting** includes a disputed baseline and the tenant's contrasting account alongside the landlord's report. Answers quote both; no conflict is automatically resolved.
- The key deduction intentionally has no linked photograph. The assistant does not claim that a photograph proves how many keys were returned.
- Photo references open the exact bundled PNG even after another item is selected. The app does not analyse image pixels or treat generation provenance as evidence of real damage.

## Storage and safety boundaries

- Isolated session files: ignored `.local-runtime/judge-sessions/`. Neither Supabase nor legacy `.companion-data/` is read or changed.
- A random HttpOnly, SameSite=Strict cookie scoped to `/api/judge` identifies one case. Sessions expire after seven days; expiry does not delete files.
- New scenarios create separate files. Existing histories are retained on disk; the UI does not yet provide an archived-case browser.
- One local server process owns the file store. Operations serialize with revision checks and atomic file replacement. It is not a multi-process production database.
- Preview IDs are tied to session, role, revision and a five-minute expiry. Confirmation revalidates business rules; retries do not duplicate events.
- Chat cannot confirm, make payments, alter reports or upload arbitrary files. Evidence is bundled synthetic material only.
- The demo route requires the offline mode, exact loopback host and same-origin writes. Authorization headers are rejected. It is not a public hosting mode.
- Database writers still use the original fixture allowlist. Sharing the pure validator does not enable database writes to the demo tenancy.

## Verification

- `npm test`: pure workflow, persistence, isolation, conversation and evidence regressions; no cloud credentials.
- `npm run test:demo:http`: requires the local server. Creates independent synthetic sessions and checks full resolution, preview cancellation, reload/resume semantics, role isolation, citations, missing/conflicting evidence and byte-for-byte reads of all four photographs.
- `npm run typecheck`: route and TypeScript checks.

**Browser acceptance completed on 2026-09-29:** the real page was exercised with keyboard activation and form controls through reply/rejection, two revised offers, acceptance and withdrawal. Refresh restored all 10 events, three resolved items and MYR 1,755 refund. Cancelled and refreshed previews did not save decisions. Missing/conflicting scenarios and report/file links were checked. Responsive checks at 320/390/760/1280 CSS pixels found no horizontal page overflow; these are desktop-browser checks, not physical-device or touch certification.

**Clean candidate installation passed:** a separate short-path Windows copy without environment files, dependencies, build output or runtime histories passed `npm ci`, all 209 tests, `npm run build`, and the live `test:demo:http` suite on 2026-09-29. A fresh GitHub clone subsequently passed installation, all 209 tests, TypeScript, lint, build and the live HTTP suite on 2026-10-02. See [GitHub delivery verification](GITHUB-DELIVERY.md) and [final acceptance](FINAL-ACCEPTANCE.md) for scope and remaining delivery checks.

For a repeatable local snapshot, run `node scripts/prepare-clean-demo.mjs` from the repository. It creates a separate temporary source tree and hash manifest, excluding private/runtime files. Use a short checkout path on Windows; an initially deeply nested copy exceeded Windows build-path limits. Keep the clean server and the normal demo server separate: only one can bind port 3030 at a time.
