# Devpost form answers (2026-10-23)

Copy-ready answers for each field of the Devpost form, written to match what the demo video shows: rule mode, typed questions, no live Bedrock call. Fields marked **[you decide]** need your own answer. Supersedes the story text in [DEVPOST-DRAFT.md](DEVPOST-DRAFT.md) wherever they differ.

---

## Project overview

**Project name**

```
RentalEase Move-Out Companion
```

**Elevator pitch**

```
A voice-first deposit companion for tenants and landlords: ask about a deduction, hear what the records say, and get a drafted reply that only you can confirm.
```

---

## Project details

**About the project** (Markdown)

```markdown
## Inspiration

At the end of a tenancy, a deposit deduction often turns into a confusing exchange of photos, report notes and messages. RentalEase Move-Out Companion focuses on that moment: helping the tenant and the landlord find the relevant record and understand which decision is still theirs to make.

## What it does

Built for the **Alexa+ track as a simulated web experience**: the browser listens and speaks, not an Alexa device. On the **Ask RentalEase** card a tenant asks, by voice or by typing, *"Was the scuff already there when I moved in?"*. The assistant reads the synthetic case only through the project's MCP tools, quotes the move-in and move-out reports, reads a short answer aloud and shows source chips that link to each quoted record.

*"Dispute the wall charge for me"* produces a draft, not a decision. It opens in a **Check before saving** preview, and nothing is recorded until the person presses **Confirm and save**. The assistant cannot decide liability, change a recorded amount or save.

Each deduction is resolved on its own. In the demo the tenant disputes the wall and cleaning charges and accepts the key charge; the landlord withdraws the wall charge and proposes MYR 20 for cleaning; the tenant accepts. A proposal changes the refund only after the tenant accepts it, and an agreed refund is never presented as a payment. The confirmed history survives a refresh.

Other MCP clients can connect to the same case: the page shows a per-case bearer token and copyable commands for MCP Inspector, Claude Code and Claude Desktop. The six tools only read records and check drafts; there is no confirm or payment tool.

Judges need no cloud keys: `npm ci && npm run dev:companion`, then open `http://127.0.0.1:3030/demo`. Without AWS settings a deterministic rule assistant answers by quoting the records, which is the mode shown in the video.

## How we built it

- **Next.js, React and TypeScript.** The independent demo stores synthetic cases in local files and reuses the same workflow, evidence and dialogue rules as the authenticated records workspace (Prisma, Supabase PostgreSQL and NextAuth, inherited from my FYP).
- **Voice** uses the browser Web Speech API: `SpeechRecognition` for input (Chrome and Edge) and `speechSynthesis` for spoken replies.
- **MCP** uses the official TypeScript SDK (protocol `2025-11-25`, Streamable HTTP) with six read-only tools: tenancy context, agreements, deduction evidence, source-based answers and draft checks.
- **Optional Amazon Bedrock path:** the server calls the Converse API with the AWS SDK for JavaScript v3, and an in-process MCP client gives the model the same tools external clients use. MCP tool schemas are flattened to the subset Amazon Nova documents for Converse tools.
- **Safety boundary:** every write follows prepare (signed, revision-bound, expiring preview) → explicit human confirmation → a database function that checks the revision and is safe to retry. Record text is treated as evidence, never as instructions.

## Challenges we ran into

- Keeping a plausible answer separate from an authorized action: the assistant may cite a real report and still over-interpret it, so answers quote records exactly and drafts must pass a rule check before they become a preview.
- Representing a revised proposal without changing the settlement total too early.
- MCP SDK tool schemas (draft-07, `additionalProperties: false`, nested `oneOf`) did not match what Amazon Nova accepts for Converse tools, so an adapter flattens them while the server still validates exact input.
- My AWS account refused every Bedrock model invocation across regions and models, on 2026-10-17 while account verification was pending and again on 2026-10-23 with "Operation not allowed". I added a diagnostic (`npm run check:bedrock`) that names the account-level cause, and recorded the demo in rule mode instead of faking a model answer.
- A lockfile generated on Windows silently dropped other platforms' native binaries, so a clean Linux install failed. A regression test now guards it.
- Browser speech recognition often misheard "RentalEase" and "scuff" in my accent, so the card also accepts typed questions.

## Accomplishments that we're proud of

A complete tenant–landlord walkthrough that runs locally with no credentials, where every saved decision has a visible preview and a human confirmation, and where an external MCP client can inspect the same case without being able to change it.

## What we learned

Guardrails belong in code, not in the prompt: role checks, revision checks and the confirmation step hold whether a rule engine or a language model drafts the request. Honest labelling (simulated Alexa+, synthetic data, AI-generated photos, rule mode) matters as much as the features.

## What's next

A live Amazon Bedrock run once my AWS account allows model invocation, testing with more microphones and accents, accessibility testing, and formal Alexa+ integration and remote MCP access behind OAuth, subject to access. The prototype does not analyse images, give legal rulings, sign documents or move money.

## Existing work

This extends my RentalEase final-year project. Account roles, rental records, agreements and an earlier settlement workflow existed before the hackathon; see `docs/BASELINE.md`. The Move-Out Companion features described above were built during the submission period.
```

**Built with** (tags)

```
next.js, react, typescript, node.js, prisma, postgresql, supabase, nextauth.js, model-context-protocol, web-speech-api, amazon-bedrock, aws-sdk
```

Remove `ollama`: it is not used by the demo.

---

## Additional info

| Field | Answer |
|---|---|
| Upload a file | Leave empty (optional). |
| Submitter Type | **[you decide]** Individual, if you submit alone. |
| Organization Name | `N/A` |
| Country of Residence | **[you decide]** Your country, e.g. Malaysia. |
| Canada province | `N/A` |
| Primary Track | The Alexa+ track. |
| GitHub repository URL | `https://github.com/sora200419/rentalease-companion` (public, MIT licence; check that "MIT" shows in the About section). |
| New or existing before Aug 31, 2026? | **Existing** (built on the FYP codebase). |
| AWS Builder Mini Challenge? | **No.** The Bedrock integration is coded and documented, but every live call was refused by the AWS account, and the project's own notes say not to claim it on mock tests alone. Choose Yes only if a live Bedrock call works before submission. |
| AWS services write-up | If you chose No, write: `Not submitting for this challenge. The project contains an optional Amazon Bedrock Converse integration, but live invocation was refused at the AWS account level, so it is not claimed.` |
| Open Source Mini Challenge? | **Yes**, if the hackathon window had started by 2026-09-21: the public MIT repository was created that day. Check the dates in the rules. |
| Contribution URL | `https://github.com/sora200419/rentalease-companion/compare/ef6c0e1b1020b76b090c33edb2e9b25a065e7b4e...main` (everything after the imported FYP baseline). |
| Project Repository URL | `https://github.com/sora200419/rentalease-companion` |
| GitHub Username | `sora200419` |
| Friction Log URL | `https://github.com/sora200419/rentalease-companion/blob/main/docs/FRICTION_LOG.md` (the Bedrock refusal row is included; push before submitting). |
| Project Testing Link | Leave empty: the demo runs only on localhost, and the project must not be exposed publicly. |
| Age / jurisdiction / not-an-employee checkboxes | **[you decide]** Tick only if each one is true for you. |
| Level of learning | **[you decide]** |
| Gained AI value for your career? | **[you decide]** |

**Existing project — what you updated during the submission period**

```
RentalEase started as my final-year project (account roles, rental records, agreements, condition reports and an earlier settlement workflow). The baseline was imported on 2026-09-21 as commit ef6c0e1 and is documented in docs/BASELINE.md. Added during the submission period:
- Move-Out Companion: per-deduction dispute, withdrawal, revised-amount proposal and acceptance, each with a signed, expiring preview and explicit human confirmation, plus revision checks and safe retries.
- An independent, credential-free judge demo (/demo) with synthetic scenarios and labelled AI-generated evidence photos.
- The "Ask RentalEase" voice card (Web Speech API) with typed questions, suggestion chips and spoken replies.
- An MCP server (official TypeScript SDK, six read-only tools) with per-case bearer tokens and a "Connect an MCP client" panel.
- An optional Amazon Bedrock assistant that reads the case only through those MCP tools, plus a connectivity check that explains account-level failures.
- An Agent Skill (SKILL.md) that drives the RentalEase MCP tools, and a dispute letter a tenant can copy or download.
- A records workspace on Supabase with restricted database functions, private evidence and exported summaries.
- Cross-platform lockfile fix and an automated regression suite.
The demo video walks through these features in rule mode.
```

**Testing instructions**

```
No credentials are needed. With Node.js 22 or later:
  npm ci
  npm run dev:companion
Open http://127.0.0.1:3030/demo (use 127.0.0.1, not localhost). Use Chrome or Edge for voice, or type questions into the card. Switch between "Tenant · Aina" and "Landlord · Daniel" at the top. "Start another scenario" resets the case. Without AWS settings the rule assistant answers. All people, records and photos are synthetic. Full walkthrough: docs/JUDGE-GUIDE.md.
```

---

## Feedback questions

**1. Which developer tools, APIs and SDKs did you use and for what?**

```
- Model Context Protocol TypeScript SDK (1.30.1): the RentalEase MCP server (six read-only tools over Streamable HTTP) and the in-process client used by the assistant.
- MCP Inspector CLI: checking the server's tool list and calls.
- Web Speech API (SpeechRecognition, speechSynthesis): browser voice input and spoken replies.
- Amazon Bedrock Converse API via AWS SDK for JavaScript v3 (@aws-sdk/client-bedrock-runtime): the optional model-backed assistant.
- Next.js 16, React 19, TypeScript: the app. Prisma 5, Supabase PostgreSQL, NextAuth: the authenticated records workspace.
- Claude Code: coding assistance, testing and documentation.
```

**2. What worked well?**

```
- MCP TypeScript SDK: defining tools with schemas was straightforward, and the same server served both my own assistant and external clients without changes.
- MCP Inspector CLI: a quick way to confirm the tool list and responses from the terminal.
- Web Speech API: voice input and output worked in Chrome with no keys or extra services.
- AWS SDK v3: a Bedrock API key in AWS_BEARER_TOKEN_BEDROCK was picked up automatically, and the Converse API kept the tool loop simple.
```

**3. What needs work?**

```
- Amazon Bedrock: every model invocation on my account returned "ValidationException: Operation not allowed" in every region and for every Nova model, with no hint that the cause was at the account level. I wrote a diagnostic script to work this out. A clear error naming the account restriction, or a console check, would have saved hours.
- Bedrock model IDs: from Malaysia/Singapore, Nova is callable only through apac. or global. inference profiles, and which ID works where was hard to find.
- AWS SDK v3: Converse uses HTTP/2; against an HTTP/1.1 mock it failed with only "Error: Protocol error".
- MCP schemas vs Amazon Nova: SDK tool schemas (draft-07, additionalProperties: false, nested oneOf) don't fit the subset Nova accepts for Converse tools, so I had to flatten them. A documented mapping would help.
- MCP Inspector CLI 2.9.0: without an Authorization header it tried interactive OAuth and failed with "Interactive OAuth requires a TTY" instead of a plain 401.
- Web Speech API: recognition often misheard product names and less common words in my accent, so I added a typed fallback.
```

**4. Onboarding experience (zero to hello world)?**

```
- MCP TypeScript SDK: smooth. The examples were enough to get a first tool working and visible in MCP Inspector.
- Web Speech API: a first recognised phrase in Chrome needed very little code; Chromium now also exposes the unprefixed SpeechRecognition, which feature detection must handle.
- Amazon Bedrock: the SDK set up quickly, but I never reached a successful live call because the account refused invocation. Region and inference-profile choices were the hardest part of setup.
```

**5. Would you build with these devices and services again?**

```
Yes. MCP made it easy to give an assistant read-only access to exactly the records it needs and to let other clients inspect the same case. I would use Amazon Bedrock again once account access is sorted, because the Converse tool loop fits this read-then-draft design well.
```

**Which AI tools have you leveraged while working on this project?**

```
Claude Code (Anthropic) for coding, tests, debugging and documentation; an AI image generator for the four clearly labelled synthetic evidence photos. [Add any others you used.]
```
