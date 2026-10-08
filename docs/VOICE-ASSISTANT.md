# Voice assistant and Amazon Bedrock

Updated 2026-10-08. This is the Alexa+ track's **simulated experience**: voice runs in the browser with the Web Speech API, and the optional AI answers come from Amazon Bedrock. It is not Alexa, uses no Amazon voice service and is not an official Amazon product.

## What a person can do

Open **http://127.0.0.1:3030/demo** after `npm run dev:companion`.

1. Tap the light ring in the **Ask RentalEase** card and ask, for example: *"Alexa, ask RentalEase whether the scuff was already there when I moved in."* The invocation phrase is optional; "Was the scuff already there when I moved in?" works too.
2. The answer is shown with source chips (for example `move-in`, `move-out`) and read aloud. Citation markers are never spoken.
3. Say or tap **"Dispute the wall charge for me"**. With Bedrock, the assistant drafts a short dispute that quotes the move-in report and shows it as the normal **Check before saving** preview. In rule mode the dispute form opens pre-filled with a quotation from the move-in report.
4. Read the draft and press **Confirm and save** yourself, or cancel it. Nothing is recorded until you confirm.

Suggestion chips (tenant and landlord sets) work without a microphone. **Spoken replies on/off** controls speech output and is remembered in the browser. Listening stops automatically after 15 seconds. Voice input pauses while a decision preview is waiting.

### Browser support

- **Chrome and Edge:** voice input and spoken replies. Chrome sends microphone audio to Google's speech service and needs an internet connection, so use only the synthetic demo data.
- **Firefox:** no speech recognition. Use the suggestion chips or type; spoken replies still work.
- **Safari:** support varies by version; the chips and typing always work.
- Allow the microphone when the browser asks. Use the exact `http://127.0.0.1:3030` address: it counts as a secure context and the demo checks its host.

## Two answer modes

| Mode | When | What answers |
| --- | --- | --- |
| Rule mode (default) | `COMPANION_BEDROCK_MODEL` is blank | The deterministic RentalEase rules. They quote records exactly and need no cloud account. |
| Amazon Bedrock | `COMPANION_BEDROCK_MODEL` is set | An Amazon Nova model (or another Converse model) that reads the case only through the RentalEase MCP tools. |

The page header and every answer show which mode answered, for example *Amazon Bedrock · apac.amazon.nova-pro-v1:0 · MCP tools: get_deduction_evidence*. If Bedrock fails for any reason, the rule assistant answers and the notice starts with *"Amazon Bedrock was unavailable, so the rule assistant answered."* The server log shows the error name and message.

## Set up Amazon Bedrock

1. In the AWS console, pick a region and confirm the Nova models are available there. For Malaysia or Singapore (`ap-southeast-5`, `ap-southeast-1`), Nova models are called through **inference-profile IDs**, not base model IDs:
   - `apac.amazon.nova-pro-v1:0`: suggested for reliable tool use; keeps routing in APAC.
   - `apac.amazon.nova-lite-v1:0`: cheaper.
   - `global.amazon.nova-2-lite-v1:0`: newer model; global routing can leave APAC.
   - In US regions use, for example, `us.amazon.nova-pro-v1:0`.

   These IDs come from AWS catalog and pricing data checked in September–October 2026; confirm them in your console before recording.
2. Create least-privilege credentials allowed to call `bedrock:InvokeModel` on the inference profile and its underlying models. Either:
   - a **Bedrock API key**, set as `AWS_BEARER_TOKEN_BEDROCK` (the AWS SDK switches to bearer authentication automatically), or
   - normal AWS credentials (`AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`, or `AWS_PROFILE`).
3. Put the settings in `.env.local` in the repository root. The file is git-ignored; never commit or screen-share it.

   ```sh
   COMPANION_BEDROCK_MODEL=apac.amazon.nova-pro-v1:0
   COMPANION_BEDROCK_REGION=ap-southeast-1
   AWS_BEARER_TOKEN_BEDROCK=your-bedrock-api-key
   ```

4. Restart `npm run dev:companion`. The header should read **Amazon Bedrock connected**.
5. Ask "Was the scuff already there when I moved in?" and check the answer label lists `get_deduction_evidence`.

Region falls back to `AWS_REGION`, then `AWS_DEFAULT_REGION`, then `us-east-1`. Credentials stay on the server; the browser only receives answers.

### Cost and limits

Each question makes up to five model calls (one per tool round), with up to 800 output tokens each and a 30-second deadline. A process-local guard allows two AI answers at a time and 40 per case per hour; beyond that the rule assistant answers. This guard is not a billing control: set an AWS budget alert as well.

## How it works

```
Browser (Web Speech API)        Next.js server (127.0.0.1:3030)
 ring / chip / text  ──POST /api/judge/assistant──▶ assistantTurn
                                                    │ rule mode ─▶ deterministic answer
                                                    │ Bedrock:
                                                    ▼
                         in-process MCP client ◀─InMemoryTransport─▶ RentalEase MCP server
                         (official TypeScript SDK)                    (same six read-only tools
                                                    ▲                  as /api/mcp)
                         Amazon Bedrock Converse ◀──┘  tool rounds
                                                    │
                         recordAssistantTurn: validated draft ─▶ "Check before saving" preview
 Confirm and save (person) ──POST /api/judge/confirm──▶ decision recorded
```

- The model sees the case **only** through the MCP tools: `list_tenancies`, `get_settlement_context`, `get_deduction_evidence`, `get_agreement`, `ask_records` and `prepare_dispute_action`. These are the same tools external MCP clients use (see [MCP.md](MCP.md)).
- Tool schemas are flattened for Amazon Nova (top level only `type`, `properties` and `required`; nested `oneOf` unions merged). The MCP server still validates the exact schema and returns mistakes as tool errors the model can correct.
- Nova 1 models get greedy decoding (temperature 0, `topK` 1). Nova `<thinking>` notes are removed before display or speech.
- The last three questions and answers for the same role are sent as context.

## Safety boundaries

- Record text is treated as evidence, never as instructions.
- The model never decides liability, fairness or who pays, and cannot save, confirm, pay or transfer anything. There is no confirmation or payment tool.
- A draft must pass `prepare_dispute_action` (role, target, revision and business rules). It becomes a preview **only** if the person's message asked for a decision; otherwise it is dropped with a note.
- Citations are filtered to real record IDs. If an answer claims something was saved or sent, a correction is appended.
- The model never confirms anything or changes a recorded amount. It can propose an amount inside a draft (for example a landlord's revised offer), but that draft changes nothing until the person confirms it, and a revised amount still applies only after the tenant accepts it. A preview expires after five minutes, and only **Confirm and save** records a decision.

## Verify without an AWS account

`scripts/mock-bedrock.mjs` is a local stand-in for the Converse API (HTTP/2, as the SDK uses). The real AWS SDK signs and sends genuine requests to it; its scripted replies only exercise the integration and are not model output.

```sh
node scripts/mock-bedrock.mjs
# in another terminal
COMPANION_BEDROCK_MODEL=apac.amazon.nova-pro-v1:0 COMPANION_BEDROCK_ENDPOINT=http://127.0.0.1:4599 \
AWS_REGION=ap-southeast-1 AWS_ACCESS_KEY_ID=mock AWS_SECRET_ACCESS_KEY=mock npm run dev:companion
# in a third terminal
npm run test:demo:http
```

## Verification status (2026-10-08)

Verified in a Linux container (Node 22.22.0):

- `npm test`: 234/234 pass, including scripted-model tests of the tool loop, drafts, fallback, role rules and schema flattening.
- `npm run test:demo:http` passes in rule mode and in Bedrock mode against the mock.
- Headless Chromium with mocked speech APIs, in both modes:
  - spoken question answered with citations;
  - spoken text without citation markers;
  - AI-draft preview (or pre-filled form) confirmed by the person;
  - 390 px layout without horizontal overflow;
  - no console errors.

**Not verified here:**

- a live call to real Amazon Bedrock;
- real microphone and speaker hardware;
- Safari and Firefox;
- a macOS clean clone.

Run the Bedrock setup above with your own account and record what you observe in [FRICTION_LOG.md](FRICTION_LOG.md) before submitting.

## Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| Header says *Rule mode* | `COMPANION_BEDROCK_MODEL` is blank or invalid, or the server was not restarted. |
| Notice: *Amazon Bedrock was unavailable* | Check the server log. `UnrecognizedClientException` or `CredentialsProviderError` means bad or missing credentials. `AccessDeniedException` means IAM does not allow `bedrock:InvokeModel`. A `ValidationException` about on-demand throughput means you used a base model ID where an inference profile (`apac.` / `us.` / `global.`) is required. |
| *Microphone access is blocked* | Allow the microphone in the address bar, or use the chips. |
| *Chrome's speech recognition needs an internet connection* | Chrome's recognition is a network service; use the chips or typing offline. |
| Nothing is spoken | Turn **Spoken replies** on and check the system volume. Some browsers need one click on the page before speech is allowed. |
