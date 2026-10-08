# Independent three-item demonstration

## Run without private credentials

Use Node.js 22. Install locked dependencies with `npm ci`, then run `npm run dev:companion`. Open **http://127.0.0.1:3030/demo** or start from `/guide`. In this mode `/` redirects to `/guide`.

In the default rule mode, no environment file, Supabase account, AWS account or credit, model download or cloud service is required for this demonstration. Dependency installation itself needs the npm registry. Amazon Bedrock is optional and stays off unless `COMPANION_BEDROCK_MODEL` is set; see [voice assistant and Amazon Bedrock](VOICE-ASSISTANT.md). Do not run database setup or migrations to use this mode. The launcher binds to loopback, explicitly disables records mode, skips admin bootstrap and blocks inherited backend APIs.

This is the Alexa+ **simulated web experience**, not an official Alexa+ connection. Voice input and spoken replies use the browser's Web Speech API, not Alexa or any Amazon voice service. The independent demo uses the same pure action validation, dialogue routing and evidence-answer rules as the records workspace. Since 2026-10-08 it also serves the same six read-only MCP tools at `http://127.0.0.1:3030/api/mcp` for local clients that hold the case's bearer token, and the optional Bedrock assistant reads the case only through those tools. The separate records workspace retains its own MCP adapter.

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

## Voice, suggestions and MCP walkthrough

Added on 2026-10-08. Start a fresh standard scenario as **Tenant · Aina**.

1. Find the **Ask RentalEase** card with the light ring. Tap the suggestion chip “Was the scuff already there when I moved in?”. Chips work without a microphone. In rule mode the answer quotes both the move-in and move-out reports, shows source chips and is labelled **Rule mode · quoted from the records**. Asking never saves anything.
2. To speak instead, tap the ring in Chrome or Edge and allow the microphone. A leading “Alexa, ask RentalEase …” is removed, so it reaches the same answer. Listening stops by itself after 15 seconds. **Spoken replies on/off** controls speech output; spoken text leaves out citation markers. In Chrome, recognition audio goes to Google's speech service and needs internet, so use synthetic data only. Firefox has no speech recognition and Safari support varies; use the chips or type instead.
3. Tap “Dispute the wall charge for me”. In rule mode the editable dispute form opens pre-filled with text quoting the move-in report. Edit it, choose **Preview decision**, then **Confirm and save** or **Cancel preview**. Voice is paused while a preview waits.
4. Switch to **Landlord · Daniel**. The chips change to “What did the tenant say about the wall?”, “Show evidence for the second deduction” and “What is the refund right now?”.
5. Open **Connect an MCP client to this case** (marked *For developers*). It shows the server URL, a bearer token for the current role, and copyable recipes for MCP Inspector, Claude Code and Claude Desktop. For example, replacing `TOKEN`:

   ```
   npx -y @modelcontextprotocol/inspector --cli http://127.0.0.1:3030/api/mcp --transport http --header "Authorization: Bearer TOKEN" --method tools/list
   ```

   This should list six tools. Inspector 2.x needs Node.js 22.19 or later; without a token it tries interactive OAuth and fails instead of reporting a plain 401. The token's role is fixed: a tenant token cannot preview landlord decisions, whatever role the browser shows. MCP tools only read and check drafts. A draft checked by an external client is not saved and does not appear as a preview on the page. Keep the token private.

**Optional Amazon Bedrock.** With `COMPANION_BEDROCK_MODEL` and AWS credentials set before `npm run dev:companion`, the header shows **Amazon Bedrock connected**. That label reflects the configuration, not a successful call. The model reads the case only through the six MCP tools, and answers are labelled like “Amazon Bedrock · apac.amazon.nova-pro-v1:0 · MCP tools: get_deduction_evidence”. In step 3 the model drafts the dispute through `prepare_dispute_action`. The draft appears in the ordinary **Check before saving** preview, marked “Drafted by Amazon Bedrock …”, and only the person pressing **Confirm and save** records it. If Bedrock fails or returns malformed tool use, the rule assistant answers and the notice starts “Amazon Bedrock was unavailable, so the rule assistant answered.” If the local usage limit is reached, the notice says the AI assistant is busy or at its hourly limit. Model IDs, regions, IAM and a local mock are covered in [voice assistant and Amazon Bedrock](VOICE-ASSISTANT.md). This path has been verified only against the local mock Converse server, not against a live AWS account.

## Conversation accuracy checks

These checks describe the default rule mode, which also answers typed and spoken questions in the **Ask RentalEase** card.

- “Accept the second deduction and dispute the first” asks which item to review first. It does not execute either decision.
- “Accept the cleaning deduction” selects cleaning even if wall was previously selected.
- “Accept the first deduction for cleaning” is contradictory and asks for clarification.
- “Accept item two” recognizes the item number. “Accept the last deduction” asks for an explicit number/name.
- “Propose a lower amount”, ranges, multiple prices and unsupported currencies do not infer an amount.
- Questions, conditional decisions, quoted instructions and negated refusals do not become confirmations.
- “Who is responsible?” does not produce a liability finding.
- With a deduction selected, condition questions such as “Was the scuff already there when I moved in?” quote both reports instead of being treated as unsupported. Questions starting with whether, if, tell me, did, does, do, has, had, explain or describe count as questions, not decisions.

In rule mode this is conservative English rule matching, not unrestricted language understanding. With Bedrock enabled, the model interprets the wording; the checks above have not been run against a real model. Any draft it prepares still passes the same business rules and preview, and a draft is dropped with a note unless the message asked for a decision. Chinese multi-item examples are tested for safe refusal, not advertised as a Chinese-language UI or conversational capability. Use the explicit action menu when a phrase is unsupported. Each message discards any earlier unconfirmed preview.

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
- Chat, voice, the optional Bedrock assistant and MCP clients cannot confirm, make payments, alter reports or upload arbitrary files. Only a person pressing **Confirm and save** records a decision. Evidence is bundled synthetic material only.
- Recorded amounts and the refund are calculated by deterministic application code. They change only when a person confirms a decision; a revised amount takes effect only at tenant confirmation. The model can draft through `prepare_dispute_action` but cannot save, confirm or recalculate anything.
- The `/api/judge` routes require the offline mode, exact loopback host and same-origin writes, and reject Authorization headers. `/api/mcp` instead requires a case bearer token (otherwise 401 with `WWW-Authenticate: Bearer`), the `127.0.0.1:3030` host, and an Origin of `http://127.0.0.1:3030` if one is sent; native clients send none. It is not a public hosting mode.
- MCP tokens (`rle_demo_` plus 43 base64url characters) are per case and per role. They are stored in the case file, with an index named by each token's SHA-256 in `.local-runtime/judge-sessions/mcp-tokens/`. They follow the browser to a newly started scenario (the previous case stops answering) and stop working when the case expires after seven days. The demo's `prepare_dispute_action` accepts deduction decisions only; there is no confirm, payment, SQL or URL tool.
- Bedrock credentials stay on the server and are never sent to the browser. When Bedrock is enabled, the question, the last three questions and answers of the same role, a short case summary and the synthetic records the model reads through the tools are sent to the configured Bedrock endpoint. The limit of 2 concurrent AI turns per process and 40 per case per hour is a process-local guard, not a billing control.
- Database writers still use the original fixture allowlist. Sharing the pure validator does not enable database writes to the demo tenancy.

## Verification

- `npm test`: pure workflow, persistence, isolation, conversation and evidence regressions, plus the voice phrasing, assistant and demo MCP token tests and a lockfile platform check. The assistant tests use a scripted stand-in for Converse. No cloud credentials.
- `npm run test:demo:http`: requires the local server. Creates independent synthetic sessions and checks full resolution, preview cancellation, reload/resume semantics, role isolation, citations, missing/conflicting evidence and byte-for-byte reads of all four photographs. It also asks the assistant a spoken-style question, and connects an MCP SDK client over real HTTP with the case bearer token (six tools, `ask_records`, an unsaved draft, 401/403 refusals).
- `npm run typecheck`: route and TypeScript checks.

**Verification on 2026-10-08** (Linux container, Node.js 22.22.0): `npm test` passed 234 of 234 tests; typecheck, lint (0 errors) and the production build passed. `npm run test:demo:http` passed in rule mode and in Bedrock mode against `scripts/mock-bedrock.mjs`, a local HTTP/2 stand-in for the Converse API. The real AWS SDK signed and sent the requests, but the mock's replies are scripted, not model output. The official MCP Inspector CLI 2.9.0 ran `tools/list` (six tools) and `tools/call ask_records` against the live demo endpoint. A headless Chromium walkthrough with mocked speech APIs covered both modes: a spoken question answered with citations and no citation markers in the spoken text, “Dispute the wall charge for me” producing an AI-draft preview (Bedrock mode) or a pre-filled dispute form (rule mode), confirmation by the person, the MCP panel showing the token, and a 390 px layout without horizontal overflow. No console errors were reported.

**Not verified:** a live call to real Amazon Bedrock (no AWS account in this environment), real microphone or speaker hardware, Safari or Firefox, a clean clone on macOS, and a real Claude Desktop install. The Claude Desktop recipe was exercised during development against an equivalent local bearer-token server, not this endpoint; the Claude Code command was not run.

**Browser acceptance completed on 2026-09-29:** the real page was exercised with keyboard activation and form controls through reply/rejection, two revised offers, acceptance and withdrawal. Refresh restored all 10 events, three resolved items and MYR 1,755 refund. Cancelled and refreshed previews did not save decisions. Missing/conflicting scenarios and report/file links were checked. Responsive checks at 320/390/760/1280 CSS pixels found no horizontal page overflow; these are desktop-browser checks, not physical-device or touch certification.

**Clean candidate installation passed:** a separate short-path Windows copy without environment files, dependencies, build output or runtime histories passed `npm ci`, all 209 tests, `npm run build`, and the live `test:demo:http` suite on 2026-09-29. A fresh GitHub clone subsequently passed installation, all 209 tests, TypeScript, lint, build and the live HTTP suite on 2026-10-02. Both runs were on Windows.

**Linux installation fixed on 2026-10-08:** the lockfile had been generated on Windows and contained only Windows builds of the native optional packages for lightningcss, @tailwindcss/oxide, sharp and unrs-resolver, so `npm ci && npm run dev:companion` failed on Linux with `Cannot find module '../lightningcss.linux-x64-gnu.node'` (macOS is expected to fail the same way; not directly tested). The 73 missing platform entries were added at the exact locked versions, leaving the original entries unchanged. A clean `npm ci`, `npm run build` and `npm run lint` (0 errors, 23 inherited warnings) then passed on Linux with Node.js 22.22.0 and npm 10.9.4. `tests/lockfile-platforms.test.mjs` fails if a platform binary goes missing again; if it fails after `npm install` on Windows, do not commit that lockfile, restore it from Git and add dependencies from macOS or Linux. See [GitHub delivery verification](GITHUB-DELIVERY.md) and [final acceptance](FINAL-ACCEPTANCE.md) for scope and remaining delivery checks.

For a repeatable local snapshot, run `node scripts/prepare-clean-demo.mjs` from the repository. It creates a separate temporary source tree and hash manifest, excluding private/runtime files. Use a short checkout path on Windows; an initially deeply nested copy exceeded Windows build-path limits. Keep the clean server and the normal demo server separate: only one can bind port 3030 at a time.
