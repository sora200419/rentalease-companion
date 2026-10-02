# Offline companion walkthrough

This page covers only the local companion. See [JUDGE-GUIDE.md](JUDGE-GUIDE.md) for both workspaces and [LOCAL-SERVER.md](LOCAL-SERVER.md) for local sessions. An in-app guide is available at `/guide` in either development mode.

## Start

Install the locked dependencies, then run `npm run dev:companion`. Visit http://127.0.0.1:3030/companion. No database, cloud account, or secret is needed. Stop with Ctrl+C.

This command enables `COMPANION_OFFLINE_DEMO=1`. The layout skips admin bootstrap and the authentication provider. Defined `/api/companion/*` operations are allowed; inherited APIs and dashboards return 503. Outside this mode, normal authentication applies and the companion service returns 404.

## Happy path

1. Start as tenant Aina. A synthetic RM2,400 deposit has a proposed RM300 wall deduction.
2. Select **Compare evidence**. The response references IN-001, OUT-001 and AGR-7. Select a reference to focus the source card.
3. Select **Prepare a dispute**. Nothing changes yet. Review the text and select **Confirm dispute**. The status changes to disputed and the activity record adds the tenant's response.
4. Refresh. Business state, the current demo role and its conversation are restored from the local server. Pending confirmations are discarded.
5. Switch to landlord Daniel. Read the shared activity record, then select **Review withdrawal** and **Confirm withdrawal**.
6. The proposed deduction becomes RM0 and the proposed refund becomes RM2,400. The UI never claims that a payment happened.

## Other scenarios

Use **Reset / change demo scenario** and confirm the reset to choose an accepted, disputed, or missing move-in report. The missing case has no move-in citation. The disputed case labels the source and response as disputed and avoids treating it as an agreed baseline.

Cancelling a draft, changing role, or refreshing does not submit an action. Only the explicit confirmation updates the local record. Confirmations are tied to the demo actor, action ID and state version; retries are idempotent within the demo state.

## Scope and limitations

- All people, records and clause text are synthetic. The room images are labelled SVG illustrations, not uploaded or AI-inspected photos.
- Default responses use a deterministic intent matcher. Optional Ollama inference has been tested with a real model; the limited evaluation and remaining unsupported-claim risk are documented in [LOCAL-MODEL.md](LOCAL-MODEL.md). No image analysis is performed.
- Demo role switching is not authentication. Fixture access checks exercise role/record boundaries, but are not a substitute for authenticated, server-enforced authorization.
- Data is saved under `.companion-data/` on the local server, with a session cookie in the browser. Old localStorage records remain untouched but are no longer read. Never use real tenant information here.
- Tabs share a session; stale writes are rejected and fetch current state for review. Changes are not pushed live to other tabs. Calculations use integer sen for the fixed MYR fixture, not a complete settlement engine.
- This offline mode changes no database schema, original tenant record, email, payment, signature, wallet or cloud resource. Private storage exists only in the separate records workspace; blockchain confirmation remains deferred.

## Verification on 2026-09-21

- 22 automated tests passed, including actor/tenancy checks, wrong-role actions, stale confirmations, retry idempotency, unknown actions, missing/disputed evidence and storage restoration.
- TypeScript check passed. Changed files pass lint; the inherited application retains 23 pre-existing warnings.
- Browser walkthrough verified evidence responses, tenant dispute, refresh persistence, landlord withdrawal and updated refund totals.
- Responsive checks at 1440px and 390px showed no horizontal overflow. Missing-evidence behavior was also exercised in the browser. No browser console errors were observed during these checks.

Authenticated Supabase retrieval, private evidence and multi-item decisions now exist separately in `/records`. See [RECORDS-UAT.md](RECORDS-UAT.md). Public deployment, formal Alexa+ runtime integration and broader accuracy evaluation remain pending.
