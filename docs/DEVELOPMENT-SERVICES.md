# Development services and next handoff

Checked on 2026-09-21 against the [official rules](https://amazonappdev2026.devpost.com/rules) and [resources](https://amazonappdev2026.devpost.com/resources).

The selected Alexa+ simulated web-experience path allows any AI/agentic tool; it does not require an Alexa device, specific SDK, or MCP server. This is not an official Alexa integration. A real AI-backed simulation is still to be implemented.

The resources page links an application for $150 in AWS credits. Approval, account eligibility, covered services, and expiry must be confirmed before relying on credits. AWS integration is optional for this primary track, but actual documented AWS usage is required for the AWS Builder mini-challenge. Do not treat credits as a guarantee of zero charges.

## No account needed for current checks

`npm test` compiles the actual pure workflow helpers into a temporary directory and runs 12 regression tests using Node's built-in test runner. It needs no API keys, database, device, or additional package. It tests inherited behavior; it is not a completed assistant or end-to-end demo. In particular, report review helpers assume an already-authorized actor; route-level tenancy isolation remains to be tested.

## Needed for the next integrated milestone

- A separate development PostgreSQL database and synthetic tenant/landlord records, never the original production database.
- Development authentication services or a deliberately isolated local demo mode, without disabling production authorization.
- A model-provider account for real AI calls. Evaluate AWS Bedrock after the owner confirms AWS account/credit availability. Do not migrate the inherited Gemini integration incidentally.
- Private object storage only when implementing original evidence upload; not required for current unit tests.

Ask the owner whether they have an AWS account, have applied for event credits, and prefer zero-spend development pending approval. Do not request account passwords or root keys in chat. Service credentials belong in local ignored environment files or a deployment secret store. Do not create paid resources without approval.

Next implementation: synthetic development data and authorized evidence retrieval, followed by the assistant and explicit confirmed actions. Use English submission materials and clearly mark simulated records.
