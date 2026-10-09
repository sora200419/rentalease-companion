# RentalEase Companion — evaluation guide

**Track: Alexa+. Submission path: simulated web experience.** No official Alexa+ runtime, Alexa skill or Amazon voice service is connected. The intended interaction is demonstrated with a browser-based prototype. Voice input and spoken replies use the browser's Web Speech API, not Alexa. An optional Amazon Bedrock assistant (AWS SDK for JavaScript, Converse API) can answer questions through the RentalEase MCP tools. It is off by default and has been verified only against a local mock of the Converse API, not a live AWS account.

## Repeatable walkthrough without credentials

Use Node.js 22, install locked dependencies with `npm ci`, and start `npm run dev:companion`. Open `http://127.0.0.1:3030/guide` (`/` redirects there), then start the local demo. No cloud credentials or paid model service are needed in default rule mode.

The guide now opens **/demo**, the independent three-item case. It includes bundled synthetic photo pairs, both demo roles, replies, revised offers, rejection/acceptance and withdrawals, all with explicit confirmation. No Supabase credentials are needed.

Follow the [complete independent walkthrough](INDEPENDENT-DEMO.md). Start with a cancelled preview, resolve each item separately, and verify the MYR 1,755 final recorded refund. Try separate missing-baseline and conflicting-account scenarios; previous histories are retained, not reset.

The role switch is a simulation, not database authorization. The older single-item `/companion` demonstration is retained separately. The independent demo passed browser workflow, responsive and no-credentials clean-install acceptance on 2026-09-29; see [verification scope and remaining delivery checks](FINAL-ACCEPTANCE.md).

On 2026-10-08 the voice, suggestion and MCP additions passed 244 automated tests, the live HTTP suite in rule mode and in Bedrock mode against the local mock, the official MCP Inspector CLI against the live demo endpoint, and a headless Chromium walkthrough with mocked speech APIs. A clean Linux `npm ci` also passed after a lockfile fix. Not verified: a live Amazon Bedrock call, real microphone or speaker hardware, Safari or Firefox, a clean macOS clone, and a real Claude Desktop install. Details are in the [independent demo verification](INDEPENDENT-DEMO.md#verification).

## What to try in five minutes

Start a fresh standard scenario on `/demo` as **Tenant · Aina**.

1. **Suggestion chip.** In the **Ask RentalEase** card, tap “Was the scuff already there when I moved in?”. The answer quotes both reports and shows source chips. No microphone is needed.
2. **Voice ring.** In Chrome or Edge, tap the light ring and ask the same question aloud, optionally starting “Alexa, ask RentalEase …”. The ring shows listening, thinking and speaking, and the spoken reply leaves out citation markers. Chrome sends recognition audio to Google's speech service, so use synthetic data only. Firefox has no speech recognition; use the chips or type.
3. **Draft, check, confirm.** Tap “Dispute the wall charge for me”. Without Bedrock, the dispute form opens pre-filled with text quoting the move-in report; choose **Preview decision**. With Bedrock, the model drafts it, and the **Check before saving** preview is marked “Drafted by Amazon Bedrock …”. Either way nothing is saved until you press **Confirm and save**, and **Cancel preview** discards it.
4. **Connect an MCP client.** Open **Connect an MCP client to this case**, copy the bearer token, and run (replacing `TOKEN`):

   ```
   npx -y @modelcontextprotocol/inspector --cli http://127.0.0.1:3030/api/mcp --transport http --header "Authorization: Bearer TOKEN" --method tools/list
   ```

   It lists the six read-only tools. Inspector 2.x needs Node.js 22.19 or later. The panel also shows Claude Code and Claude Desktop recipes; those were not run against this endpoint in a real client install.

**Without Bedrock** (default), answers are labelled **Rule mode · quoted from the records** and no cloud keys are used. **With Bedrock**, set `COMPANION_BEDROCK_MODEL` and AWS credentials before starting; answers are then labelled with the model ID and the MCP tools it called. If Bedrock fails, the rule assistant answers and the page says so. To exercise the Bedrock path without an AWS account, run the local mock described in [voice assistant and Amazon Bedrock](VOICE-ASSISTANT.md); its replies are scripted, not model output.

## Authenticated records on the configured development machine

Run `npm run dev:records` and open `http://127.0.0.1:3031/guide`. Assigned synthetic credentials are delivered privately by the owner, never in this repository or a public video. See [database setup](SUPABASE-DEVELOPMENT.md).

- Sign in as fixture B's tenant and open the authorized tenancy.
- Inspect the three-item summary: repainting withdrawn, cleaning accepted at MYR 20.00, key accepted at MYR 25.00. The retained case records MYR 1,755.00 from a MYR 1,800.00 deposit.
- Select the first item to inspect the wall photo pair; select the second for the kitchen pair. The images say **AI-GENERATED DEMO — NOT REAL EVIDENCE**.
- In the rental conversation, ask “Show evidence for the second deduction.” Check its selected context and citations. Closed items intentionally offer no new settlement decisions.
- Review the saved disputes, withdrawal, reply rejection, revised proposal, revised-amount acceptance and final item acceptance. Preview cancellation is verified by UAT, not by inventing a saved event.
- Download the current text summary. Check the revision, excluded withdrawn amount, references and decision history. It is not a payment receipt.
- Sign out and use the corresponding landlord account to review the same case. Do not reset retained database history.

The rental conversation queries and previews through a real local MCP connection using the official TypeScript SDK. Its six tools are read-only; confirmation stays in the application. This does not connect to a formal Alexa+ runtime. See [MCP.md](MCP.md) for protocol and authorization boundaries. The independent demo serves the same six tools over its synthetic case at `http://127.0.0.1:3030/api/mcp` with per-case bearer tokens; its boundaries are listed in the [independent demo guide](INDEPENDENT-DEMO.md#storage-and-safety-boundaries).

The records endpoint is local-only. A remote judge cannot reach a localhost URL on the owner's machine. A safe remote evaluation arrangement or separate isolated setup must be agreed before submission; existing development credentials must not be published.

## Reproducible checks

- `npm test`: pure business, conversation, evidence and summary regressions, plus voice phrasing, assistant, demo MCP token and lockfile platform checks; no cloud credentials. The assistant tests use a scripted stand-in for Bedrock Converse. 244 of 244 passed on 2026-10-08.
- `npm run test:mcp`: standard-client protocol, tool schemas, preview and access-isolation checks with synthetic records, including the demo endpoint's bearer token, host and Origin checks.
- `npm run test:demo:http`: against the running `npm run dev:companion` server; the full demo workflow plus the assistant and an MCP SDK client over real HTTP with the case bearer token. Passed on 2026-10-08 in rule mode and in Bedrock mode against the local mock.
- `npm run typecheck`: TypeScript verification.
- `npm run test:records:http`: against the running records server; checks four assigned logins, MCP handshake/tools/previews, cross-tenancy denial, read-only answers, summaries and sign-out.
- `npm run test:records:resolution`: database state-machine checks in a rolled-back transaction, not a fixture reset.
- `npm run test:records:evidence`: private file read/byte-integrity checks; see the script for fixture prerequisites.

The `test:records:*` network checks require the existing development configuration; `test:demo:http` needs only the local demo server. Never use production tenant data.

## Limits and provenance

English only. Rule-mode conversation matching is limited. Optional local-model source selection in the records workspace and the optional Bedrock assistant in the demo are experimental. No image analysis or legal decision is made. Recorded amounts, the refund calculation and confirmation stay in deterministic application code. The model can only draft a decision through `prepare_dispute_action`, which applies the same role and business rules; only a person pressing **Confirm and save** records it. Voice depends on the browser: Chrome and Edge offer recognition, Firefox does not, and Safari support varies. Speech was tested with mocked browser APIs, not real microphone or speaker hardware. Exported copies must be kept private by the recipient.

Inherited FYP code and new work are separated in [BASELINE.md](BASELINE.md). The [UAT log](RECORDS-UAT.md) describes the exact browser path verified, not every possible branch. The [local-model log](LOCAL-MODEL.md) records known semantic limitations.
