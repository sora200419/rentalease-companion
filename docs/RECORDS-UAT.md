# Records workspace UAT

Date: 2026-09-26

Environment: local `/records` server with the Supabase development project

Data: synthetic fixture B only; no payment or public deployment

## Browser acceptance path

The full two-role flow was completed with separate tenant and landlord test accounts:

1. Tenant linked the labelled W01/W02 wall photos and K01/K02 kitchen photos to their matching deductions, then disputed the wall and kitchen deductions.
2. Landlord reviewed the wall dispute and withdrew the first deduction. Refund changed from RM1,625 to RM1,725; the withdrawn history remained visible.
3. Landlord replied to the kitchen dispute. Tenant rejected the reply. The RM50 amount and refund stayed unchanged.
4. Landlord proposed RM20 for the kitchen deduction. The preview showed that acceptance would change the refund to RM1,755; saving the proposal alone did not change the current amount.
5. Tenant accepted the RM20 proposal. The second deduction became ACCEPTED and the refund became RM1,755 while the third item remained PROPOSED.
6. Tenant accepted the third RM25 deduction. The workspace showed `AGREED` and all three items were resolved independently.
7. A full browser refresh restored the persisted result: deposit RM1,800, refund RM1,755, first deduction WITHDRAWN, second and third ACCEPTED, settlement AGREED. The conversation also restored with a stale-answer notice.

## Verified behaviours

- Every write had a review screen and a separate **Confirm and save** step.
- Cancelling a prepared withdrawal left the revision, amount and refund unchanged.
- Tenant and landlord saw the same append-only history after switching accounts.
- A revised amount remained pending until the tenant explicitly accepted it.
- Evidence panels followed the selected deduction. Wall and kitchen pairs were shown only for their linked items; the unlinked key item showed empty panels.
- Evidence answers exposed report and private-file references rather than claiming that image contents had been analysed.

## Remaining work

This is a development UAT record, not a production sign-off. Remaining work is presentation and hardening: record the short English demo, arrange safe judge access, and complete production reviews for authentication, rate limiting, malware scanning, retention and storage operations. Judge instructions are now in JUDGE-GUIDE.md. Formal Alexa+ integration remains conditional on permissions; the current entry uses the simulated web-experience alternative.

## Download, responsive layout and dialogue regression — 2026-09-26

- Clicked **Download current summary** in the real browser and verified a new text file in the operating system's Downloads folder (5,010 bytes for retained revision 13). Checked the revision, MYR 45.00 deductions, MYR 1,755.00 refund, photo filenames, decision history and non-payment disclaimer. The browser automation download-event waiter timed out previously, but the file had actually been saved. A second click produced a second timestamped download, confirming this was not just an API assertion.
- Added a truthful “Download requested” status directing users to their downloads; the page does not claim the OS saved a file without being able to observe that fact.
- Inspected records at 320, 390, 760 and 1280 CSS-pixel widths and the guide at 320, 390 and 760. Fixed 320px horizontal overflow caused by the sign-out control. No document-level horizontal overflow remained at these widths.
- Phone-width controls now use at least 44px button height and 16px editable/select text. The conversation composer stacks vertically. These were desktop-browser viewport checks, not physical iOS/Android-device certification.
- On the phone-width page, selected item 2 from the summary; deduction context and kitchen file references followed it.
- Filled an unsaved report draft, then sent “I accept the second deduction but reject the first.” The assistant asked for one item/decision, retained the current item, emptied the old draft and disabled its review button.
- “What happens if I accept?” returned a read-only explanation, not an accepting draft.
- Prepared a synthetic report only to inspect the 320px preview, then cancelled it. Refresh restored revision 13 and the prior outcome; no report was saved.
- Added 48 regressions: multiple items, mixed/conditional/quoted decisions, explicit reply versus proposal targets, mismatched/unlabelled amounts, malformed item numbers, missing notes/reports, disputed baselines, contradictory quoted statements and selected-item safety guards. All 127 tests passed, as did TypeScript and changed-file lint checks.
- Four-account live HTTP checks passed for summaries, selected-item read-only/liability/access guards, foreign-deduction refusal, unchanged revisions, sign-out and restricted database access.

Accuracy boundaries: unsupported phrasing asks for clarification or use of the action menu. The application does not semantically adjudicate contradictory reports or prove what happened; it retains both accounts and warns that no conflict has been resolved. Optional-model tests here use controlled source-selector responses, not a new broad real-model evaluation.

## Local MCP integration — 2026-09-27

- Connected the records conversation to a real MCP server using the official TypeScript SDK 1.30.1 and stateless Streamable HTTP. Six tools read authorized records or prepare a read-only preview; none saves or confirms an action.
- Passed 142 automated regressions, including 15 MCP tests for initialization, discovery, protocol validation, strict tool inputs, account isolation, stale revisions, private-reference handling and previews. Monetary inconsistencies block amount-changing actions but do not prevent users from disputing or refusing a record.
- Passed the live HTTP suite with all four synthetic accounts. Standard SDK clients initialized, discovered/called tools, prepared report previews, rejected foreign tenancies and caller-injected identity, and lost access after sign-out. Before/after records were unchanged. An earlier run failed at a settlement-context assertion; added finer stage diagnostics and the complete rerun passed without weakening assertions.
- In the browser, “Show evidence for the second deduction” initially returned monetary totals. Fixed this routing error and verified it now returns the selected deduction's report notes and linked K01/K02 file references. Explicit refund queries still return amounts.
- Verified a report preview through MCP followed by the existing signed-review endpoint. **Confirm and save** remained a separate control. Cancelled the preview, cleared the draft through the conversation and refreshed: revision 13, MYR 1,755.00 refund and all three prior resolutions remained unchanged. No report or settlement decision was saved.
- Checked the new preview/cancel path at 390 CSS pixels; no horizontal document overflow. Reset the viewport afterwards. This is a desktop-browser responsive check, not physical-device testing.
- Observed access rejection during a long-running browser session. The page now shows a plain-English reauthentication message instead of raw MCP/JSON-RPC error text. Signing in again restored successful previews and private photo display; no access restrictions were relaxed.
- Changed-file lint, TypeScript and the full production build passed. The inherited application still prints missing Upstash configuration warnings during the build; no paid Redis service was enabled. The first build attempt hit a Windows Prisma DLL lock while the development server was running; stopping that server allowed the complete build to finish. AWS hosting, remote OAuth and formal Alexa+ runtime integration are not part of this local verification.

## Local MCP request hardening — 2026-09-28

- Added process-wide and verified-account concurrency limits, bounded per-account request buckets, and `Retry-After` responses. These are local single-process safeguards, not distributed abuse protection or an AWS spending cap.
- Limited incoming bodies by actual bytes, checked JSON/UTF-8 and single-message framing, and bounded body reads to five seconds. Rejected bearer credentials on the cookie-only local adapter; no remote authorization mode was enabled.
- Added a 20-second browser deadline covering initialization and the tool call together. Timeouts and access/busy errors have readable messages; the helper does not automatically retry an operation or follow redirects.
- Passed all 158 automated regressions, including 31 MCP tests. The 16 new hardening cases cover quota separation/refill, bounded state, concurrency cleanup, spoofed identity, malformed/oversized/slow/aborted bodies, browser request settings and stalled initialization/tool calls.
- Passed the complete live HTTP suite again with all four synthetic accounts: SDK handshake, discovery, authorized queries, previews, foreign-tenancy refusal, caller-identity refusal, summary access, selected-item safety, sign-out and restricted database privileges. Before/after revisions were unchanged. An earlier run stalled and failed in the existing question endpoint; its cause was not established. The HTTP test runner now bounds network waits, and this complete rerun passed without weakening assertions.
- In the actual browser, signed in as the fixture-B tenant and asked “Show evidence for the second deduction.” The answer selected the kitchen item and cited K01/K02, retaining the recorded-statements/no-image-analysis caveat. Prepared a synthetic inspection report, verified the separate **Confirm and save** control, then cancelled without saving. Reload restored revision 13 and all three prior resolutions, with no preview or report draft retained.
- TypeScript, changed-file lint, `git diff --check` and the full production build passed. The inherited missing-Upstash warnings remain; no Redis or other paid service was enabled.
- Added `MCP-REMOTE-PLAN.md` with future OAuth/account-linking and deployment acceptance criteria. It is a design plan only: no public endpoint, AWS resources, remote tokens or formal Alexa+ integration were created. No business records, private files or payment state were changed during this verification.

## Remote authorization core and access research — 2026-09-28

- Implemented a separate, unmounted remote-handler factory and JWT access-token verification core. No application route, environment switch, public listener, identity-provider registration or AWS resource enables it. The existing `/api/mcp` route still uses local cookie authentication and rejects bearer credentials.
- Passed 175 automated regressions (48 MCP tests, including 17 new remote-authorization tests). Real ES256/RS256 signatures, source-specific audience/issuer, expiry, allowed clients, scopes, account grants, revoked tokens, retired signing keys and two-account isolation were tested locally with ephemeral keys and synthetic services. No tokens or private signing keys are persisted or printed.
- Tested metadata and 401/403 challenges, read-only versus preview discovery, consent narrowing, same-email isolation and rejection of token-supplied identities/key URLs. The official SDK initialized and previewed through the in-process bearer adapter without saving records. An initial preview test correctly failed because its arbitrary tenancy ID was outside the existing development-fixture allowlist; the test fixture was corrected, not the business guard.
- Complete production build, TypeScript and changed-file lint passed. The previous Upstash warnings remain. `jose` 6.2.12 is a pinned direct dependency for the new verifier; NextAuth retains its compatible nested 4.15.9 dependency.
- Passed the full four-account live HTTP suite after restarting the local server: credential sessions, MCP SDK calls/previews, source/summary access, isolation, sign-out and database privileges remain intact, with unchanged business revisions. The first login rerun failed because the restricted Windows process could not obtain TLS security-package credentials (`P1011`); a read-only check under approved normal-host permissions succeeded, then the server and suite passed in that same environment. No passwords, certificate validation or account permissions were changed.
- Checked the live adapter remains closed to remote access: `/api/mcp` rejects a synthetic bearer credential with 400; protected-resource metadata is absent (404); an unknown remote API path is rejected by the existing scoped-records mode guard (503). No remote routes were added to the production build.
- Confirmed the public Alexa+ permission limitation in the hackathon FAQ and Amazon developer-docs home. This was not a private Amazon-account access check. The allowed independent simulation path is documented in `ALEXA-ACCESS.md`; no Alexa CLI or runtime was exercised.
- Real managed OAuth consent/account linking, PKCE/code exchange, refresh tokens, persistent grant storage and remote hosting remain unimplemented. The new tests are not an end-to-end OAuth or Alexa certification.

## Independent demo and expanded dialogue regressions — 2026-09-28

- Added `/demo` with an isolated, local-file-backed three-item case, both simulated roles, four bundled labelled photographs and standard/missing/conflicting evidence scenarios. No database migrations, Supabase writes, cloud credentials or paid services were used.
- Shared the existing pure action validator while retaining the database wrapper's fixture allowlist. Each independent-demo action requires a role/revision-bound preview and explicit confirmation. New scenarios retain old local session files.
- Passed **209 automated regressions**, including **34 new tests** for the complete multi-item lifecycle, rejected replies/offers, cancellation, refresh/resume semantics, persistence, independent sessions, expired/stale/tampered previews, named and word-numbered targets, ambiguous prices and contradictory evidence.
- Passed the live standalone HTTP suite: full role-switch workflow to MYR 1,755 refund, no payment; source citations; role-specific conversations; origin/authorization refusals; cancelled/resumed previews; retained prior scenarios; exact-byte reads of all four PNGs; unavailable move-in files in the missing scenario.
- TypeScript, changed-file lint, whitespace checks and the production build passed. Inherited missing-Upstash build warnings remain; no Redis service was enabled.
- This pass did not re-run the private four-account Supabase suite or change retained database fixtures. Shared helper regressions passed with the rest of the test suite.
- **Not yet verified in a browser:** actual new-page clicks, reload rendering, image layout and narrow-screen appearance. The browser tool's automatic approval review could not run due to a usage limit, and no alternative automation was used to bypass that check. HTTP tests are not represented as browser QA.

## Independent demo final acceptance — 2026-09-29

This pass supersedes the independent-demo browser blocker above, not earlier private-records findings.

- Exercised the actual page through tenant disputes, landlord reply, tenant rejection, MYR 30 proposal/rejection, MYR 20 proposal/acceptance, key acceptance and wall withdrawal. Keyboard/form interactions produced ten saved events, three resolved items and MYR 1,755 refund, retained after reload.
- Checked cancel and refreshed-preview discard, multi-item clarification, amount clarification, source links, missing baseline and conflicting-account warnings. Responsibility questions did not determine liability.
- Checked 320/390/760/1280 CSS-pixel layouts and narrow-screen confirmation controls. No horizontal document overflow or unloaded displayed images was observed. These are desktop responsive checks, not physical-device or pointer-input certification.
- An independent short-path Windows source snapshot without environment files passed locked installation, all 209 regressions, production compilation and the complete standalone HTTP suite. An initial deeply nested copy failed Windows path-length limits. The source snapshot is not a remote GitHub clone; delivered-revision parity remains outstanding.
- The clean server was stopped and the regular local demo restored. No Supabase history, cloud resources, payments or repository publication was changed. See [full acceptance scope](FINAL-ACCEPTANCE.md).
