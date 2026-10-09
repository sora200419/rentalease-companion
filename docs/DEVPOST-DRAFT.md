# Devpost submission draft — owner review required

Updated 2026-10-08 for the voice assistant, the optional Amazon Bedrock path and the demo MCP endpoint (previous update: 2026-10-02, independent three-item demo). This is a draft, not a submitted entry. Recheck the [official rules](https://amazonappdev2026.devpost.com/rules) before submission. The submission path was verified on 2026-09-28 as allowing an Alexa+ simulated web experience; formal runtime access is not claimed.

## Project name

RentalEase Move-Out Companion

## Elevator pitch

A voice-first deposit companion for tenants and landlords: ask about a deduction, hear what the records say, and get a drafted reply that only you can confirm.

## About the project

### Inspiration

At the end of a tenancy, a deposit deduction can become a confusing exchange of photos, report notes and messages. RentalEase Move-Out Companion focuses on that moment: helping both people find the relevant record and understand which decision is still theirs to make.

### What it does

Built for the **Alexa+ track as a simulated web experience**. A tenant taps the light ring on the **Ask RentalEase** card and asks: *"Alexa, ask RentalEase whether the scuff was already there when I moved in."* The browser's speech recognition hears the question; it is not Alexa. With Amazon Bedrock configured, an Amazon Nova model reads the synthetic case only through the project's MCP tools. It answers in short spoken sentences, with source chips for the records it quoted and a label naming the tools it called.

Next, *"Dispute the wall charge for me"* becomes an AI-drafted dispute in the ordinary **Check before saving** preview. The model cannot save, set amounts or decide liability. Only the person pressing **Confirm and save** records a decision. A landlord can reply, withdraw a deduction or propose a different amount, and the tenant accepts or rejects the available response. Each of the three deductions is resolved independently. Proposals do not change the amount until accepted, and agreement never means a payment has been sent.

Judges do not need AWS. Without `COMPANION_BEDROCK_MODEL`, a deterministic rule assistant answers instead. For the scuff question it quotes both reports and reads a short summary aloud; for the dispute request it pre-fills the editable form. Any Bedrock error falls back to it visibly. The independent `/demo` runs without private service credentials, with labelled move-in/move-out photo pairs and standard, missing-baseline and conflicting-account scenarios. It retains decisions after refresh and asks for clarification when a request combines items or leaves an amount unclear.

Judges can also connect their own MCP client to the case. `npm run dev:companion` serves `http://127.0.0.1:3030/api/mcp`, and the demo page shows a per-case bearer token with copyable recipes for MCP Inspector, Claude Code and Claude Desktop. The six tools only read records and check drafts; there is no confirm or payment tool.

The separately authenticated records workspace also saves authorized decisions to Supabase, reads private evidence and exports a dated settlement summary. That workspace needs the owner's development configuration; it is not required to run the independent judge walkthrough.

### How it was built

The project uses Next.js, React and TypeScript, with Prisma, Supabase PostgreSQL and private Supabase Storage in the authenticated development workspace. NextAuth sessions establish the account role. Restricted database functions enforce state transitions, revision checks and retry safety after an explicit preview and confirmation.

The independent demo stores synthetic cases in local files and reuses the shared workflow, evidence and conservative English dialogue rules. Voice runs in the browser with the Web Speech API: `SpeechRecognition` for input (Chrome and Edge) and `speechSynthesis` for spoken replies. It is not Alexa and uses no Amazon voice service.

The optional AI path calls the Amazon Bedrock Converse API from the server with the AWS SDK for JavaScript v3 (`@aws-sdk/client-bedrock-runtime`). It is off unless `COMPANION_BEDROCK_MODEL` is set, and credentials never reach the browser. An in-process MCP client, built with the official MCP TypeScript SDK, connects to the same RentalEase MCP server that external clients use, so the model sees the case only through its tools. Tool schemas are flattened to the subset Amazon Nova documents for Converse tools. Each question gets at most five tool rounds and a 30-second deadline.

Record text is treated as evidence, never as instructions. A draft must pass `prepare_dispute_action` (role, revision and business rules) and becomes a preview only when the person's message asked for a decision. Citations are filtered to real records. Money and action authorization do not depend on model output: the model can propose an amount inside a draft, but recorded amounts and the refund change only after a person confirms (and a revised amount only after the tenant accepts), and the model can never confirm.

MCP uses the official TypeScript SDK 1.30.1, protocol `2025-11-25`, over Streamable HTTP. Six read-only tools expose tenancy context, recorded agreements, deduction evidence, source-based answers and draft checks. The demo endpoint accepts per-case, per-role bearer tokens; the authenticated records endpoint uses the records login session. Saving remains a separate human-confirmed application action. This is local protocol integration, not a live Alexa+ connection.

Optional local Ollama inference was an earlier experiment for source selection in the records workspace. It is not used by `/demo` or the Bedrock path.

### Challenges and lessons

The hardest boundary was keeping a plausible answer separate from an authorized action. A model can cite a real report and still add an unsupported interpretation, so the records workspace uses exact quotations and visible references. Another challenge was representing a revised proposal without prematurely changing the settlement total.

Connecting MCP to Bedrock needed an adapter. MCP SDK tool schemas (draft-07, `additionalProperties: false`, nested `oneOf`) do not match the JSON Schema subset Amazon Nova documents for Converse tools, so the schemas are flattened for the model while the MCP server still validates the exact input. The AWS SDK sends Converse over HTTP/2, and a plain HTTP/1.1 local mock produced only `Error: Protocol error` until a stack trace showed why. Working out which inference-profile IDs (`apac.` or `global.`) to use for Nova from Malaysia or Singapore was also harder than expected.

A lockfile generated on Windows had silently dropped other platforms' native binaries, so `npm ci && npm run dev:companion` failed on Linux. The 73 missing entries were added at the locked versions, and a regression test now guards them.

On 2026-10-08, in a Linux container (Node 22.22.0), all 244 automated regressions passed, together with TypeScript, lint (0 errors) and the production build. Tests cover role separation, stale confirmations, retries, missing evidence and independent deduction decisions, and now also the Bedrock tool loop, draft handling, fallback and MCP tokens. `npm run test:demo:http` passed in rule mode and in Bedrock mode against a local mock Converse server. A headless Chromium walkthrough with mocked speech APIs passed in both modes, including the AI-draft preview, the person's confirmation and a 390 px layout. The official MCP Inspector CLI listed the six tools and called `ask_records` against the live demo endpoint. **Not verified:** a live Amazon Bedrock call, real microphone or speaker hardware, Safari, Firefox, a macOS clean clone, or a real Claude Desktop install.

Earlier records remain as history. 209 regressions passed in a clean source copy on 2026-09-29 and in a fresh GitHub clone on 2026-10-02, both on Windows. The 2026-09-29 browser walkthrough retained ten confirmed events and a MYR 1,755 refund, and responsive layouts were checked at four widths. The demo uses synthetic roles and visibly labelled generated photos, not real tenant evidence.

### Existing work and hackathon additions

This project extends my RentalEase FYP codebase. Account roles, rental records, agreements and an earlier settlement workflow predate this hackathon work. The companion work adds the separate simulated experience, conversational context, confirmation-bound records actions, restricted Supabase development access, private evidence reading/linking, multi-item resolution and exported summaries. Added on 2026-10-07/08:

- the browser voice card (**Ask RentalEase**, Web Speech API) with suggestion chips and spoken replies;
- the optional Amazon Bedrock assistant, which reads the case through the MCP tools and turns decision requests into previews;
- rule-mode condition answers that quote both reports, with a short spoken summary and a pre-filled dispute form;
- the demo MCP endpoint with per-case bearer tokens and the **Connect an MCP client** panel;
- the cross-platform lockfile fix and its regression test.

The baseline commit and boundaries are documented in [BASELINE.md](BASELINE.md).

### What comes next

A live Amazon Bedrock run with real AWS credentials and testing with real microphones and speakers come first. Broader accuracy and accessibility testing and production authorization follow. The independent demo already provides a locally runnable judge walkthrough. Formal Alexa+ integration and remote MCP access behind OAuth are future work subject to access and validation. This prototype does not perform image analysis, legal adjudication, signatures or payments.

## Built with

Next.js, React, TypeScript, Node.js, Prisma, PostgreSQL, Supabase, NextAuth.js, Model Context Protocol (MCP TypeScript SDK), Amazon Bedrock (Converse API), Amazon Nova, AWS SDK for JavaScript v3, Web Speech API.

MCP uses the official TypeScript SDK 1.30.1 in both local endpoints. The Amazon Bedrock integration is implemented and tested end to end with the real AWS SDK against a local mock Converse server (`scripts/mock-bedrock.mjs`). It has not been tested against a live AWS account. Before claiming live results, the owner must run it with real AWS credentials (see [voice assistant and Amazon Bedrock](VOICE-ASSISTANT.md)) and record what happened. Keep the Amazon Nova tag only if that run used a Nova model.

Ollama was an earlier local experiment in the records workspace; mention it in the story if needed, not as a tag. Do not list Alexa SDK, Lambda or S3: they are not used. Alexa+ is the target track, not an existing runtime integration, and browser voice is the Web Speech API.

## Links and media still required

- Repository: https://github.com/sora200419/rentalease-companion. Public, released under the MIT License ([LICENSE](../LICENSE), copyright sora200419). Recheck the rules' source-access requirements before submission.
- A real video URL after recording/upload, following the [demo script](DEMO-SCRIPT.md). Do not enter a placeholder or localhost as a public demo.
- Cover/gallery screenshots that visibly label the simulation and synthetic evidence. `docs/images/voice-rule-mode.png` shows rule mode; take Bedrock-mode screenshots only from a live run, not from the mock.
- Reviewed developer feedback. [FRICTION_LOG.md](FRICTION_LOG.md) holds the earlier local-model observations. Check that it also covers the 2026-10-07/08 observations below, and add your own from the live Bedrock run.

## Developer feedback (draft)

Observed during development on 2026-10-07/08. None of it comes from a live Bedrock call.

- **npm lockfile across platforms:** a lockfile generated on Windows silently dropped other platforms' native optional binaries (npm/cli#4828), breaking `npm ci` on Linux (macOS is expected to fail the same way but was not tested). It was caught only by installing on Linux.
- **AWS SDK for JavaScript v3 (`@aws-sdk/client-bedrock-runtime` 3.1147.0):** Converse goes over HTTP/2 by default. Against an HTTP/1.1 local mock it failed with only `Error: Protocol error` (`ERR_HTTP2_ERROR`). A clearer error or a documented note would help.
- **MCP tools and Amazon Nova:** MCP SDK schemas (draft-07 with `$schema`, `additionalProperties: false`, nested `oneOf`) do not match the subset Nova documents for Converse tools, so an adapter flattens them. A recommended MCP-to-Converse schema mapping would help.
- **Regions and inference profiles:** from Malaysia/Singapore, Nova models are called through `apac.` or `global.` inference-profile IDs, and Nova 2 Lite only through the global profile. Region and profile availability was hard to determine.
- **Positive:** a Bedrock API key in `AWS_BEARER_TOKEN_BEDROCK` is picked up by the SDK automatically.
- **MCP Inspector 2.9.0 CLI:** without an Authorization header it attempts interactive OAuth and fails with "Interactive OAuth requires a TTY" instead of reporting a plain 401.
- **Web Speech API:** Chromium now exposes unprefixed `SpeechRecognition`, so feature detection and test mocks must cover both it and `webkitSpeechRecognition`.

Distinguish inherited work, new additions and future plans in the final submission. Before selecting the AWS Builder bonus (mini-challenge), check its rules: [DEVELOPMENT-SERVICES.md](DEVELOPMENT-SERVICES.md) records that it requires actual documented AWS usage, and so far Bedrock has only been exercised against a local mock. Do not select it on the strength of the mock tests, or because Supabase infrastructure may run on AWS.
