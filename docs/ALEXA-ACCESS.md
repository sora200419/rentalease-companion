# Alexa+ access and submission boundary

Checked: 2026-09-28. This records public requirements, not a check of the owner's private Amazon account. Updated 2026-10-08 with the repository decision and current deliverable; the access findings were not re-checked.

## Confirmed access limitation

The [official hackathon FAQ](https://amazonappdev2026.devpost.com/details/faqs) says Alexa+ Category SDK, MCP Toolkit, CLI and Web Simulator are partner-preview tools; ordinary participants currently cannot apply for access. An individual public setup guide should not be interpreted as proof of eligibility or account access.

The [Amazon developer docs home](https://developer.amazon.com/docs/alexaplus/add-ons/home.html) independently marks Category SDK and MCP Toolkit as available to selected partners only.

AWS promotional credits do not establish that permission. Do not ask the owner for AWS access keys, pay for an Alexa subscription, create a legacy Alexa skill or deploy AWS infrastructure in an attempt to unlock the preview.

The FAQ and [Official Rules](https://amazonappdev2026.devpost.com/rules) allow an independently demonstrated MCP/Agent Skill or simulated experience. The FAQ clarifies that a locally runnable public repository plus video can suffice without hosting. RentalEase continues with its own web front end and MCP implementation on the Alexa+ track's simulated experience path. Nothing was published during the 2026-09-28 check. The repository is now public with an MIT `LICENSE` (owner decision recorded 2026-10-08).

## If the owner already has a separate partner invitation

Ask only for non-secret confirmation of the invitation, enabled product and available onboarding instructions. Never request passwords, client secrets, redemption codes or AWS keys in chat. Public documentation alone is not proof that this account has access. Do not claim registration or deployment until Amazon returns a verified result.

## Formal integration requirements, when access exists

Amazon's [MCP account-linking documentation](https://developer.amazon.com/docs/alexaplus/add-ons/mcp-toolkit-account-linking.html) describes authorization-code flow with PKCE S256, refresh tokens, resource parameters, protected-resource metadata and static client registration. Its supported redirect URIs must be registered exactly; Dynamic Client Registration is not supported for this flow. An appropriate privacy policy is also required. These are provider/client integration tasks, not supplied by our JWT verifier.

Before any external resources are created, agree the provider, account, region, cost limit and synthetic dataset. Then verify real authorization, denied consent, refresh, revocation and account isolation. A generic OAuth implementation does not prove Alexa interoperability.

## Current deliverable

As of 2026-10-08:

- Independent demo with a local MCP endpoint (`http://127.0.0.1:3030/api/mcp`, per-case bearer tokens, synthetic case, no credentials): working. MCP Inspector CLI 2.9.0 listed its six tools and called `ask_records` on 2026-10-08. See [MCP.md](MCP.md).
- Optional Amazon Bedrock assistant that reads the case only through the same MCP tools: implemented, off by default, verified only against a local mock Converse server. It has not been tested against a live AWS account.
- Browser voice simulation on `/demo`: working in headless Chromium with mocked speech APIs. It uses the browser's Web Speech API, not Alexa or any Amazon voice service. Real microphone/speaker hardware, Safari and Firefox were not verified. See [VOICE-ASSISTANT.md](VOICE-ASSISTANT.md).
- Local authenticated records workspace and MCP tools: working.
- Remote JWT verification, scope checks, metadata and HTTP adapter: offline-tested, disabled and unmounted.
- Managed OAuth provider, consent/linking UI and persistent revocation store: not configured or implemented.
- Public hosting or formal Alexa+ runtime: not enabled. No Alexa+ Add-on, Category SDK, MCP Toolkit or Web Simulator is connected; the submission is a simulated Alexa+ experience.

See [MCP-REMOTE-PLAN.md](MCP-REMOTE-PLAN.md) for the implementation boundaries and remaining acceptance gates.
