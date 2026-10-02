# Private development evidence

The authenticated `/records` workspace supports supplementary PNG, JPEG and PDF files attached to an existing report. Use synthetic files only. This is a local development feature, not a production-ready document vault.

## Setup

Keep these values in the ignored `.env.records.local`, alongside the existing records database and authentication settings:

```dotenv
SUPABASE_URL=https://rgthmushgkithgkmszsy.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<server-only sb_secret_ key>
```

The variable name is retained for compatibility; this implementation expects a new Supabase secret key. Never expose it through a `NEXT_PUBLIC_` variable or commit it.

Run `node --use-system-ca scripts/provision-private-evidence.mjs` to inspect the development bucket. Add `--apply` to create it if missing. The script only targets the configured development project and `rentalease-evidence-dev`. It refuses public or incompatible buckets. Existing objects are not deleted.

Start `npm run dev:records`, then open `http://127.0.0.1:3031/records`. On supported Windows Node versions the launcher uses the system certificate store without disabling certificate validation.

## Workflow and boundaries

Select a published report, choose a file, review the selection, then explicitly confirm upload. Unconfirmed files remain local. Files are supplementary: original report text is not overwritten. The server checks current tenancy membership and report ownership for each list, upload and download request. Only the development fixture accounts are supported.

- Private bucket; downloads are proxied through the authenticated app, not public links.
- PNG/JPEG previews use the same authenticated route with `preview=1`. The route verifies the content signature and SHA-256 against the stored object name, serves private/no-store responses, and does not use a public image optimizer. PDFs remain download-only.
- 5 MiB per file; PNG/JPEG/PDF header validation; maximum 50 files per report.
- Names include uploader identity and a SHA-256 content hash. Repeating the same upload with the same filename and account does not overwrite or duplicate it.
- No deletion endpoint, automated OCR, photo interpretation, malware scanning, legal decisions, payments or public deployment.
- Upload throttling is process-local. Production needs shared rate limiting, malware scanning, operational monitoring, quotas and a review of authorization and retention policies.
- The storage secret bypasses storage RLS; server-side access checks are therefore essential. It never reaches the browser.

Run `npm run test:records:evidence` against the running server. It retains one tiny synthetic PNG and an append-only deduction reference. Checks include access isolation, explicit confirmation, invalid-file rejection, duplicate retries, exact downloaded/previewed bytes, source references in deduction answers, public URL denial and signed-out access denial. It does not erase test history. This protocol-level test is not a completed browser walkthrough or a visual-quality evaluation.

## Reading and linking evidence

The evidence reader displays two selectable image panels, initially choosing move-in and move-out images linked to the selected deduction. A missing linked image leaves that panel empty rather than silently attributing another item's photograph. A user can manually choose another tenancy image for inspection. Each panel shows the filename, report type/reference, upload time, and authenticated source download. Upload time does not establish when a photograph was taken. The panels support visual comparison by a person; the app does not analyse image contents.

Four full-size demo photographs in `demo-assets/evidence/` show a pre-existing wall scuff (W01/W02) and a kitchen before/after cleaning scenario (K01/K02). Every image embeds **AI-GENERATED DEMO — NOT REAL EVIDENCE**. Generation prompts and provenance are retained alongside the originals. These assets are outside `public/`; staged copies use the same private bucket and authorization path as other test files. `node --use-system-ca scripts/stage-demo-evidence.mjs --apply` stages them through the ordinary authenticated upload endpoint without overwriting existing objects.

Select a deduction, choose **Link to this deduction**, inspect the preview, and confirm the reference. `EVIDENCE_LINK` verifies that the file exists under a published report in the same tenancy. Both parties can read the saved association. Linking changes neither the file nor any financial amount and does not verify authenticity. Duplicate links are refused; a retry of the same confirmed token reuses its receipt. References can be added to closed deductions without reopening them.

Deduction-scoped answers quote current report notes and show only that deduction's saved file references. References open through authenticated app routes; they do not expose the storage secret or create public download URLs. Missing reports stay explicit. Every demonstration image must be visibly labelled synthetic; filenames and report descriptions should identify the depicted test scenario. Do not present generated or staged examples as real tenant evidence.

## Dispute actions

A tenant can dispute a proposed deduction or explicitly accept it. A landlord can reply, withdraw a proposed/disputed deduction, or propose a revised amount for an open dispute. The tenant can accept or reject the latest reply or amount proposal. Each deduction is handled separately; remaining proposed or disputed items keep the settlement open.

Replies and proposals alone do not change financial amounts. Accepting the latest amount proposal changes that deduction and its recorded refund atomically; rejection retains the current amounts and dispute. Withdrawal excludes that deduction from the total but preserves its original amount and history. Ordinary reply acceptance confirms the existing amount and is unavailable while a revised-amount proposal awaits a decision. Superseded or decided replies/proposals cannot be accepted again. Final agreement is `AGREED`, not proof of payment.

Every write uses a separate preview and explicit confirmation. The shared record retains reasons, referenced parent events, and before/after financial effects. `npm run test:records:resolution` exercises transitions in a database transaction that is deliberately rolled back; it does not reset or delete previously committed demonstration history.

The action conversation is a limited keyword router into a structured preview/confirmation form, with an English UI and support for a few Chinese ordinal/refusal phrases. Tenancy selection, selected deduction and recent conversation are scoped by account in browser session storage; signing out clears that account's local context. Draft confirmations are not restored after refresh. Earlier messages are labelled potentially stale; current database records remain authoritative. This is not an unrestricted natural-language agent or a formal Alexa+ integration. The hackathon's simulated web-experience route remains a separate presentation/integration task, not blocked on gated Alexa+ tooling.
