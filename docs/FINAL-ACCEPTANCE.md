# Final local acceptance — 2026-09-29

Scope: the independent `/demo` submission candidate, using synthetic records and bundled labelled photographs only. No Supabase records, AWS resources, payments, public deployment or remote repository changes were made.

## Results

| Check | Result |
| --- | --- |
| Fresh locked dependency install | PASS: 543 packages; Prisma client generation without an environment file |
| Automated regressions in clean copy | PASS: 209/209 |
| Production compilation in clean copy | PASS; inherited missing-Upstash configuration warnings remain |
| Clean-copy local server and HTTP workflow | PASS: complete resolution, isolation, confirmation/cancel/resume, citations, all four exact photo files, missing/conflicting evidence |
| Actual browser dispute workflow | PASS: ten confirmed events; wall withdrawn, cleaning accepted at MYR 20, key accepted at MYR 25 |
| Final recorded amount and reload | PASS: MYR 1,755 refund; 3/3 resolved; revision 10 retained |
| No-write paths | PASS: cancel and reload discard previews; ambiguous/multi-item conversation does not confirm actions |
| Evidence limitations | PASS: missing baseline named; disputed baseline/counter-account displayed; responsibility question refuses to infer liability |
| Source navigation | PASS: report anchor targets the displayed report; W01 opens a separate image tab; linked images load |
| Responsive page | PASS: 320, 390, 760 and 1280 CSS-pixel layouts; no horizontal document overflow; narrow-screen preview/confirm/cancel controls readable |

Browser workflow used keyboard activation, selection and text entry. It is not a touchscreen, physical-phone, cross-browser, mouse-input or full accessibility certification. Browser console error inspection before the server swap was empty. Full-page screenshot stitching produced duplicate bands, so viewport captures were used for visual inspection and the final proof image.

## Clean-copy provenance

- Snapshot script: `scripts/prepare-clean-demo.mjs`.
- Candidate: 378 files from the current local working tree, including untracked candidate code, excluding `.env*`, Git metadata, dependencies, generated builds and runtime/private data.
- Manifest SHA-256: `d3714d00756b389e9f6c67cc7de0d157ef529ea19e29ba208799d3c6d42f49b2`.
- Tested directory: `C:/Users/ONG/AppData/Local/Temp/rentalease-clean-st3mCg`.
- Node.js 22.15.0 on Windows. The install used the system CA trust option and an npm cache, not disabled TLS verification. It still installed dependencies into an empty candidate tree.
- An initial deeply nested candidate failed with Windows path-length errors; the external short-path copy built successfully. Neither copy nor previous histories was deleted.
- The clean server was stopped after testing, and the normal local demo server restored. A pre-existing browser cookie temporarily produced the expected missing-session response against the separate store; HTTP tests used their own independent session cookies.

Documentation changes recording these results were made after the source snapshot; application code was not changed during acceptance. This is not a test of a remote GitHub clone or a clean operating-system installation.

## Remaining submission work

The GitHub synchronization and fresh-clone check were subsequently completed on 2026-10-02: locked installation, 209 tests, TypeScript, lint, production build and the standalone HTTP suite passed. See [delivered-revision verification](GITHUB-DELIVERY.md). This later check supersedes the remote-clone limitation of the original 2026-09-29 report.

1. Confirm the judges' source access and the owner's licensing arrangement for the delivered repository.
2. Record the English demo video and align the Devpost story/screenshots with `/demo` and its actual capabilities.
3. Complete the owner's final Devpost submission.

Official Alexa+ access is not connected or verified for this account. The candidate demonstrates the simulated web experience; it must not be described as a live Alexa+ integration, image-understanding system, legal adjudicator or payment processor. The private records/Supabase suite was not rerun in this acceptance pass.
