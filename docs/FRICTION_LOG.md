# Developer feedback and friction log

Record observations when they occur. Do not turn hypothetical issues or inherited code findings into claims about a newly tested SDK.

| Date | Tool / version | Task attempted | Expected | Observed | Severity | Workaround | Suggested improvement |
|---|---|---|---|---|---|---|---|
| 2026-10-07/08 | npm lockfile generated on Windows; npm 10.9.4 on Linux | `npm ci && npm run dev:companion` on Linux | Clean install and dev server | Lockfile held only Windows builds of the native optional packages for lightningcss, `@tailwindcss/oxide`, sharp and unrs-resolver; startup failed with `Cannot find module '../lightningcss.linux-x64-gnu.node'` (npm/cli#4828). Caught only by installing on Linux; macOS expected to fail the same way, not tested | High: blocks a fresh install | Added the 73 missing platform entries at the locked versions; `tests/lockfile-platforms.test.mjs` | npm should keep other platforms' optional entries when regenerating a lockfile, or warn |
| 2026-10-07/08 | `@aws-sdk/client-bedrock-runtime` 3.1147.0 | Converse against a local mock via a custom endpoint | Request reaches the mock, or an error that names the cause | The SDK uses HTTP/2 by default; against a plain HTTP/1.1 mock it failed with only `Error: Protocol error` (`ERR_HTTP2_ERROR`) and no hint about HTTP/2. A stack trace was needed to diagnose it | Medium | Serve the mock over HTTP/2 (`scripts/mock-bedrock.mjs`) | Clearer error text, or a documented note on HTTP/2 for custom endpoints |
| 2026-10-07/08 | MCP TypeScript SDK 1.30.1 tool schemas; Amazon Nova via Converse | Pass MCP tool schemas as Converse tool input schemas | Schemas usable as-is | SDK schemas (draft-07 with `$schema`, `additionalProperties: false`, nested `oneOf` from a discriminated union) do not match the subset Nova documents for Converse tools (top level only `type`/`properties`/`required`). Found by comparing against documentation, not a live Nova call | Medium | Adapter flattens schemas for the model; the MCP server still validates the exact schema | Document a recommended MCP-to-Converse schema mapping |
| 2026-10-07/08 | Amazon Bedrock Nova model IDs, `ap-southeast-5` / `ap-southeast-1` | Choose a callable model ID for a developer in Malaysia/Singapore | A base model ID callable in the chosen region | Nova is callable there only through inference-profile IDs (`apac.` / `global.`), and Nova 2 Lite only through the global profile. A base model ID fails with a `ValidationException` about on-demand throughput. Region/profile availability was hard to determine. From catalog/documentation research; not reproduced with a live call | Medium | Listed suggested profile IDs and the error in [VOICE-ASSISTANT.md](VOICE-ASSISTANT.md) | A clear per-region table of callable IDs for each model |
| 2026-10-07/08 | AWS SDK credential chain, `AWS_BEARER_TOKEN_BEDROCK` | Use a Bedrock API key | Separate credential handling in application code | Positive: the SDK picks up the key and switches to bearer authentication automatically. No real key was tested against live Bedrock | Positive | None needed | None |
| 2026-10-08 | MCP Inspector CLI 2.9.0 | `tools/list` against the demo endpoint without an `Authorization` header | A plain 401 report | Attempted interactive OAuth and failed with `Interactive OAuth requires a TTY` | Low | Pass `--header "Authorization: Bearer TOKEN"` | Report the 401 and `WWW-Authenticate: Bearer` plainly in CLI mode |
| 2026-10-07/08 | Chromium (headless, Playwright) Web Speech API | Feature detection and test mocks for speech recognition | Only the prefixed `webkitSpeechRecognition` | Chromium now exposes unprefixed `SpeechRecognition`, so detection and mocks must cover both names | Low | Detect and mock both constructors | Show both names in feature-detection guidance |

## Observed development friction — 2026-10-08

The rows above were recorded on 2026-10-07 and 2026-10-08 while building the voice assistant, the Bedrock adapter and the demo MCP endpoint with an AI coding assistant. They are observations from that work; the schema and model-ID rows come from comparing against AWS documentation and catalog data, not from a live call. The owner should review them and add their own before submission. Severity is an assessment of impact on this project. Nothing here comes from a live Amazon Bedrock call: there was no AWS account in this environment, and the Bedrock path was exercised only against a local mock Converse server.

- **Cross-platform lockfile:** the broken install did not show on Windows and surfaced only when installing on Linux. See [GITHUB-DELIVERY.md](GITHUB-DELIVERY.md#cross-platform-lockfile) for the fix and the regression test.
- **AWS SDK and a local mock:** the `Protocol error` message did not mention HTTP/2; the cause was found only from a stack trace.
- **MCP to Converse:** MCP tool schemas needed an adapter before they could be offered to Amazon Nova. The MCP server remains the validator.
- **Region and inference profiles:** the suggested IDs in [VOICE-ASSISTANT.md](VOICE-ASSISTANT.md) come from AWS catalog data and have not been confirmed with a live call.

## Observed local-model friction

These observations are recorded in [LOCAL-MODEL.md](LOCAL-MODEL.md). They concern tested local inference, not Alexa+, AWS or an Amazon SDK.

- **Ollama / qwen3:4b, 2026-09-22:** cold inference exceeded the configured 45-second deadline while warm English calls took roughly 1–1.8 seconds. The app used a visible rule fallback. The cold run failed its evaluation and was not reported as passing. Clearer readiness/progress signals before the first question would help.
- **Evidence interpretation:** an answer cited an available source but added a “new scuff” interpretation absent from the text. Citation validation alone did not establish factual correctness. The records workspace now uses optional AI for source-ID selection and renders exact source text; broader semantic evaluation remains necessary.
- **Action boundary:** liability/payment requests needed deterministic handling even when phrasing was indirect. Business amounts and confirmations remain outside model authority.

## Not yet evaluated

No formal Alexa+ runtime has been exercised. The AWS SDK for Bedrock has been exercised only against a local mock Converse server; no live Amazon Bedrock call, real microphone or speaker hardware, Safari, Firefox or macOS clean clone has been tested (as of 2026-10-08). Do not present missing access, hypothetical concerns or inherited code findings as measured SDK feedback. The owner should review and supplement this log with their own observations before submission, including what they observe when running Bedrock with real credentials.
