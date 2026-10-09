# Remote MCP acceptance plan — verification core implemented, not deployed

Current live capability: local Streamable HTTP, records-cookie authorization, local per-case bearer tokens for the independent demo (added 2026-10-08), six read/preview tools and process-local request protection. A separate bearer-token verification core and HTTP adapter now have offline integration tests. They are not mounted in the application or connected to an identity provider. This is not a complete OAuth/account-linking implementation, an Alexa+ approval, or permission to publish the development database.

## Implemented and verified offline — 2026-09-28

`mcp-authorization.ts` verifies JWT access tokens with pinned `jose` 6.2.12. Its deliberately narrow profile requires `at+jwt`, RS256/ES256, an exact trusted issuer, a single exact resource audience, an allowed client, subject, token ID, scopes, integer issue/expiry times and at most a one-hour lifetime. It rejects unsigned/symmetric tokens, ID tokens, expired/future tokens and token-supplied key URLs. A provider using opaque tokens or a different access-token profile will need a reviewed adapter; compatibility with any particular provider is not claimed.

The verifier uses injected trusted-key, current-account-grant and token-revocation services. The grant must match issuer, subject, client and resource; the account must be active and consent unexpired/unrevoked. Tokens at or before the grant's `validAfter` cutoff are rejected, including the same second. Effective access is the intersection of token scopes and current consent. No email-based linking, token-provided roles, token passthrough or browser-cookie fallback occurs.

`mcp-remote.ts` provides a disabled-by-default HTTP handler factory, protected-resource metadata and 401/403 challenges. Read-only callers discover five tools; adding `rentalease:records:preview` exposes the sixth read-only preview tool. Crafted preview calls without scope fail before record retrieval. Every request rechecks identity and consent. The factory reuses the existing body and process-local traffic protections, validates exact HTTPS destination/Host/Origin, and accepts tokens only in the Authorization header. No cross-origin browser CORS flow is implemented.

Tests generate ephemeral asymmetric keys in memory and make in-process HTTPS `Request` objects with synthetic services. There is no listening remote port, outbound identity-provider request, stored signing key or cloud resource. They verify two identities with the same email remain isolated, revoked grants/tokens lose access on the next request, public-key rotation works, current consent narrows tool discovery and SDK previews never save. Existing fixture-only business-action guards remain unchanged.

Run `npm run test:mcp` to include these checks. They do not test authorization-code exchange, refresh-token issuance, real provider discovery, PKCE, consent screens, persistent grants or a real Alexa client.

## Alexa+ permission finding

The official hackathon FAQ checked on 2026-09-28 says the gated preview tools are not available to ordinary hackathon participants and there is no participant application path. The submission can use a self-hosted MCP server or simulated experience, with a locally runnable repository and demo video. Do not make formal access a dependency or interpret AWS credits as Alexa+ access. See [ALEXA-ACCESS.md](ALEXA-ACCESS.md).

## Work that can stay local

Keep testing protocol, exact source retrieval, role separation, revision checks, malformed requests, throttling and network failures with synthetic services. Do not create public tunnels, AWS resources, cloud model calls or new credentials as part of this stage. The demo's optional Amazon Bedrock assistant is separate from remote MCP access: it is off unless the person running the demo configures it, and calls the MCP tools in-process ([VOICE-ASSISTANT.md](VOICE-ASSISTANT.md)). The current application remains loopback-only. The records endpoint still rejects bearer-token requests.

Since 2026-10-08 the independent demo endpoint (`http://127.0.0.1:3030/api/mcp`) accepts local per-case, per-role bearer tokens so native MCP clients can read its synthetic case. These are random tokens issued by the demo page and checked against a local file store. They are not OAuth access tokens, are not verified by `mcp-authorization.ts`, and do not enable remote access: the endpoint still requires the loopback Host and a same-origin or absent Origin. Remote OAuth, account linking and consent remain unimplemented. See [MCP.md](MCP.md) for the token model.

## Remote identity and consent

Select a supported authorization provider and client/account-linking flow only after the intended remote client's requirements are confirmed. Reuse a maintained provider rather than issuing home-grown OAuth tokens. A remote access token must be issued for this MCP resource, not for Supabase, AWS or the records website.

The verification core checks signature, allowed algorithm, trusted issuer, exact resource audience and validity times before looking up an account. Still implement the explicit user flow that links the verified issuer-and-subject pair to a RentalEase account; never trust an email match, role claim or caller-supplied tenant ID as account ownership. Persistent link/grant storage is not implemented. Suspended, deleted, unlinked and revoked accounts must remain denied.

Implemented scopes separate record reading (`rentalease:records:read`) from preview preparation (`rentalease:records:preview`, additionally requiring read). Neither scope grants submission, confirmation, arbitrary database access, storage administration or payments. Still build the consent and revocation UI showing the client, requested access and linked account. Human confirmation stays inside the authenticated records application. Scope enforcement is tested offline, not enabled remotely.

## Remote protocol and infrastructure gates

Before external testing, mount the tested metadata/challenge handler only after the deployment is approved and its identity provider configured. Add trusted authorization-server discovery, bounded public-key refresh, persistent consent/revocation storage and account linking. Test actual refresh, PKCE S256, exact redirect matching, denied consent and identity-provider outages. Apply timeouts to provider/database dependencies. Do not pass external tokens through to downstream services or follow arbitrary discovery URLs into private networks.

A remote deployment also needs HTTPS, deployment-specific Host/Origin validation, an explicit client policy, shared rate limits, secret storage, request/transaction timeouts, bounded logs and operational monitoring. Logs must omit token values, raw evidence, prompts and private file identifiers. File malware scanning and retention remain separate production work.

Use an isolated synthetic judge dataset and owner-approved access arrangement. Existing local development credentials and test-account files must not be shipped in a deployment bundle or published in a video. A remote OAuth implementation must pass independent account-isolation and revocation tests before the loopback restriction is changed.

## Owner decisions before creating external state

Confirm the deployment account and region, credit redemption and eligible services, a small spending budget, the intended client/provider, and which synthetic data can be reachable remotely. Budget alerts do not stop charges. Review actual service pricing before creating resources. Formal Alexa+ permissions and integration validation remain a distinct gate; passing local MCP tests does not satisfy that gate.

References: [MCP authorization](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization), [MCP security guidance](https://modelcontextprotocol.io/docs/2025-11-25/tutorials/security/security_best_practices), [Streamable HTTP](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports).
