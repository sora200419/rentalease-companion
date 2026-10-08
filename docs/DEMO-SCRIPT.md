# English demonstration script

Updated 2026-10-08. Target: 2 minutes 45 seconds; keep the final cut under 3 minutes. This is a recording plan, not an existing video. Rehearse timing and show actual UI behavior. It replaces the 2026-10-02 plan, which opened on the guide page and used only the action menu.

## Before recording

Work through this list in the browser profile you will record with.

- [ ] **Amazon Bedrock.** Set `COMPANION_BEDROCK_MODEL` and AWS credentials (or a Bedrock API key) in `.env.local`, then restart `npm run dev:companion`. Model IDs, region and IAM are in [voice assistant and Amazon Bedrock](VOICE-ASSISTANT.md). The header's **Amazon Bedrock connected** only reflects the configuration. Ask one rehearsal question and check that the answer label starts *Amazon Bedrock ·* and the notice does not start "Amazon Bedrock was unavailable". Set an AWS budget alert as well.
- [ ] **No mock on camera.** Never record against `scripts/mock-bedrock.mjs`: its replies are scripted test fixtures, not model output. If the live run does not work, record the rule-mode version below.
- [ ] **Chrome.** Use Chrome (Edge also supports voice input). Chrome sends microphone audio to Google's speech service and needs internet; only synthetic data is on screen.
- [ ] **Microphone.** Open exactly `http://127.0.0.1:3030/demo` and allow the microphone when asked. Mute or move away any real Alexa device, because the spoken question starts with "Alexa".
- [ ] **Fresh standard scenario.** Choose **Start another scenario**, keep **Standard · report and photo pairs**, then **Confirm new scenario**. Check: **Tenant · Aina**, the wall deduction selected, refund MYR 1625.00, 0 / 3 resolved.
- [ ] **Spoken replies on.** The toggle under the voice card should read **Spoken replies on**. Check the volume; some browsers need one click on the page before they speak.
- [ ] **Synthetic labels visible.** Keep the "Alexa+ track · simulated experience" note and the **AI-GENERATED DEMO — NOT REAL EVIDENCE** photo captions in frame whenever they are on screen. Do not crop them out.
- [ ] **Token out of the video.** The **Connect an MCP client to this case** panel and the Inspector command show a bearer token. Blur it in the edit, or record in a new browser profile whose case you will not reuse: a new profile gets a new case and new tokens, while **Start another scenario** keeps the same tokens. In the terminal, set the token off camera (`TOKEN=…`) and use `Bearer $TOKEN`.
- [ ] **Terminal ready.** Use Node.js 22.19 or later (MCP Inspector 2.x needs it). Run the Inspector command once before recording so `npx` has already downloaded it.
- [ ] **Messages ready to paste.** The action menu needs three short messages: the cleaning dispute, the wall withdrawal and the MYR 20 proposal. Acceptances fill in their own text.
- [ ] **Clean screen.** Close `.env.local`, the AWS console, other tabs and notifications. The Next.js development badge is already disabled in this mode.
- [ ] **Rehearse** the whole sequence in a separate scenario and time the Bedrock answers, then start a fresh scenario for the take. If waiting for the model pushes the cut past 3:00, narrate over the thinking state or trim pauses with visible cuts. Never cut out a fallback notice or a confirmation step.

### Rule-mode version

Without Bedrock the same script works, with three changes:

- Answers are labelled **Rule mode · quoted from the records**.
- "Dispute the wall charge for me" opens the dispute form pre-filled with a quotation from the move-in report. Press **Preview decision**, then **Confirm and save**.
- The narration says "the rule assistant" and does not mention Amazon Bedrock or Amazon Nova.

## 0:00–0:10 — The question, spoken

Open on `/demo` with the **Ask RentalEase** card in view. Editing caption: *Simulated Alexa+ experience · browser speech recognition · synthetic data.* Tap the light ring and say:

“Alexa, ask RentalEase whether the scuff was already there when I moved in.”

The ring moves from listening to thinking.

## 0:10–0:40 — A cited, spoken answer

Let the reply play aloud in full. Point to the source chips and the label under the answer, for example *Amazon Bedrock · apac.amazon.nova-pro-v1:0 · MCP tools: get_deduction_evidence* (yours shows your model and the tools actually called). Click one chip to jump to the quoted report. Show the answer exactly as it came; if it is wrong, re-record and note what happened in [FRICTION_LOG.md](FRICTION_LOG.md).

“This is a simulated Alexa+ experience: my browser heard me, not an Alexa device. Amazon Bedrock read this synthetic case only through RentalEase's own MCP tools. The label shows which tools it called, and each source chip links to the record it quoted.”

## 0:40–1:10 — “Dispute the wall charge for me”

Tap the ring and say “Dispute the wall charge for me.” The **Check before saving** preview appears, marked “Drafted by Amazon Bedrock from the quoted records.” Hold on the draft long enough to read it, then press **Confirm and save**. Show the new entry in **Shared decision history**.

“Asking for a decision only produces a draft, checked by a tool that applies the role and business rules. The model can't decide who is liable, change a recorded amount or save. Nothing is recorded until I press Confirm and save.”

## 1:10–1:35 — The tenant's other two items

Use the action menu. Select **Kitchen cleaning → Dispute this deduction**, paste the reason, then **Preview decision → Confirm and save**. Select **Replacement key → Accept this proposed deduction → Preview decision → Confirm and save**.

“Each deduction is a separate decision. I dispute the cleaning charge and accept the twenty-five ringgit key charge, each with its own preview.”

## 1:35–2:00 — The landlord, briefly

Switch to **Landlord · Daniel**. Select the wall item: **Withdraw this deduction**, paste the message, **Preview decision → Confirm and save**. Select cleaning: **Propose a revised amount**, paste the message, enter 20.00, **Preview decision → Confirm and save**. Only if rehearsal leaves time, tap the chip “What did the tenant say about the wall?”.

“Switching roles simulates the landlord. He withdraws the wall charge and proposes twenty ringgit for cleaning. A proposal doesn't change the refund until the tenant accepts it.”

## 2:00–2:20 — Three resolved items

Switch to **Tenant · Aina**, select cleaning, then **Accept the revised amount → Preview decision → Confirm and save**. Show **Resolved deductions 3 / 3**, **Current refund MYR 1755.00** and the history. Refresh once to show the result is kept.

“Wall withdrawn, cleaning accepted at twenty ringgit, key at twenty-five. The recorded refund is one thousand seven hundred and fifty-five ringgit. Agreed is not paid: no money moves, and refresh keeps the confirmed history.”

## 2:20–2:30 — Connect an MCP client

Scroll to **Connect an MCP client to this case** and open it, with the token blurred. Cut to the terminal and run the Inspector command from the panel:

```sh
npx -y @modelcontextprotocol/inspector --cli http://127.0.0.1:3030/api/mcp --transport http --header "Authorization: Bearer $TOKEN" --method tools/list
```

Hold on the six tool names.

“Other MCP clients can use the same server. With this case's token, MCP Inspector lists the six read-only tools. There is no confirm or payment tool.”

## 2:30–2:45 — The boundary

Show the page header and the simulation note.

“Without AWS, rule mode runs the same flow by quoting the records. This builds on my RentalEase FYP; voice, Bedrock, MCP and multi-item resolution are new for the hackathon. Formal Alexa+ integration comes next, subject to access.”

## After recording

- Check that the cut is under 3:00 and the token is unreadable in every frame, in the panel and the terminal.
- Check that no credentials, `.env.local` or AWS console appear.
- Record what the live Bedrock run did (model ID, region, any fallback) in [FRICTION_LOG.md](FRICTION_LOG.md) before describing it as a live result in the [Devpost draft](DEVPOST-DRAFT.md).

The downloadable summary and the authenticated Supabase workspace belong to `/records` on port 3031, not `/demo`. Show them only in a separately labelled optional segment, and only if the video still stays under 3 minutes.
