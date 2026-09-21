# Development services and next handoff

Checked on 2026-09-21 against the [official rules](https://amazonappdev2026.devpost.com/rules) and [resources](https://amazonappdev2026.devpost.com/resources).

The selected Alexa+ simulated web-experience path allows any AI/agentic tool; it does not require an Alexa device, specific SDK, or MCP server. This is not an official Alexa integration. An experimental local-AI simulation is now available; see [quality limitations](LOCAL-MODEL.md).

The resources page links an application for $150 in AWS credits. Approval, account eligibility, covered services, and expiry must be confirmed before relying on credits. AWS integration is optional for this primary track, but actual documented AWS usage is required for the AWS Builder mini-challenge. Do not treat credits as a guarantee of zero charges.

## No account needed for current checks

Owner decision (2026-09-21): zero-spend development. The owner may have a school-managed AWS account; ownership and post-graduation access are not yet confirmed. Do not provision potentially billable resources or make paid model calls. Credits do not override this constraint. Prefer local synthetic data, offline tests, and explicitly labelled mock providers until service eligibility and cost controls are verified and the owner approves any change.

`npm test` runs 37 workflow/domain/service tests. `npm run test:companion:http` checks a running local service with synthetic sessions. Neither needs keys or cloud services. Real Qwen3 4B inference was tested locally, with quality limitations recorded in [LOCAL-MODEL.md](LOCAL-MODEL.md). Production isolation still requires real account integration.

## Needed for the next integrated milestone

- A separate development PostgreSQL database and synthetic tenant/landlord records, never the original production database.
- Development authentication services or a deliberately isolated local demo mode, without disabling production authorization.
- No model-provider account is needed for the local Ollama path. Cloud model integration remains optional and requires separate cost approval. Do not migrate the inherited Gemini integration incidentally.
- Private object storage only when implementing original evidence upload; not required for current unit tests.

Ask the owner whether they have an AWS account, have applied for event credits, and prefer zero-spend development pending approval. Do not request account passwords or root keys in chat. Service credentials belong in local ignored environment files or a deployment secret store. Do not create paid resources without approval.

Next implementation: improve bilingual evidence accuracy and expand adversarial/multi-turn evaluation before submission readiness; then authenticated server evidence retrieval. Use English submission materials and clearly mark simulated records.
