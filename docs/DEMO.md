# Offline companion walkthrough

## Start

Install the locked dependencies, then run `npm run dev:companion`. Visit http://127.0.0.1:3030/companion. No database, cloud account, or secret is needed. Stop with Ctrl+C.

This command enables `COMPANION_OFFLINE_DEMO=1`. The root layout skips admin bootstrap and the authentication session provider. The proxy rejects all `/api/*` and `/dashboard/*` requests with 503 in this mode, including inherited authentication APIs. Without this flag, the normal application's authentication rules continue to apply.

## Happy path

1. Start as tenant Aina. A synthetic RM2,400 deposit has a proposed RM300 wall deduction.
2. Select **Compare evidence**. The response references IN-001, OUT-001 and AGR-7. Select a reference to focus the source card.
3. Select **Prepare a dispute**. Nothing changes yet. Review the text and select **Confirm dispute**. The status changes to disputed and the activity record adds the tenant's response.
4. Refresh. Business state and the role-specific conversation are restored. Pending confirmations are deliberately discarded, and the page opens as the tenant.
5. Switch to landlord Daniel. Read the shared activity record, then select **Review withdrawal** and **Confirm withdrawal**.
6. The proposed deduction becomes RM0 and the proposed refund becomes RM2,400. The UI never claims that a payment happened.

## Other scenarios

Use **Reset / change demo scenario** and confirm the reset to choose an accepted, disputed, or missing move-in report. The missing case has no move-in citation. The disputed case labels the source and response as disputed and avoids treating it as an agreed baseline.

Cancelling a draft, changing role, or refreshing does not submit an action. Only the explicit confirmation updates the local record. Confirmations are tied to the demo actor, action ID and state version; retries are idempotent within the demo state.

## Scope and limitations

- All people, records and clause text are synthetic. The room images are labelled SVG illustrations, not uploaded or AI-inspected photos.
- Responses use a small deterministic intent matcher. Unknown questions explain the supported operations; no model API or image analysis is called. This is not yet a complete AI-backed Alexa+ simulation.
- Demo role switching is not authentication. Fixture access checks exercise role/record boundaries, but are not a substitute for authenticated, server-enforced authorization.
- Data stays in this origin's `localStorage` under `rentalease-companion-demo-v1`. Browser data can be edited by the user. Never store real tenant information here.
- Use a single tab: changes are not synchronized between tabs, devices, or real users. Financial calculations are in integer sen for the fixed MYR fixture, not a complete settlement engine.
- No database schema, original tenant record, email, payment, signature, wallet, or cloud resource is changed. No private storage or blockchain confirmation flow is included yet.

## Verification on 2026-09-21

- 22 automated tests passed, including actor/tenancy checks, wrong-role actions, stale confirmations, retry idempotency, unknown actions, missing/disputed evidence and storage restoration.
- TypeScript check passed. Changed files pass lint; the inherited application retains 23 pre-existing warnings.
- Browser walkthrough verified evidence responses, tenant dispute, refresh persistence, landlord withdrawal and updated refund totals.
- Responsive checks at 1440px and 390px showed no horizontal overflow. Missing-evidence behavior was also exercised in the browser. No browser console errors were observed during these checks.

Next milestone: connect authenticated server evidence retrieval and a real model provider while retaining explicit action confirmation. Cloud usage remains subject to the owner's zero-spend constraint.
