# Source baseline

Initialized on 2026-09-21 from the owner-provided archive `MR_ONG_YE_HONG_TP074096_APD3F2509SE_SE_FYP_SOURCE_CODE.zip`.

- Archive SHA-256: `a395dc32820cde0fd4506ed175a7ab1f81b654297e10027a85f9db2282fd2282`.
- Imported root: `rentalease-malaysia-submission/`.
- Baseline commit: `ef6c0e1b1020b76b090c33edb2e9b25a065e7b4e`.
- Imported files: 262. The archive's real `.env` was excluded before the first commit.
- This is a fresh Git history. The import date is not the creation date of the inherited features.
- Existing GitHub projects and the source archive were not modified.

## Inherited functionality

Account roles, property/room/tenancy management, agreement generation and revision, signing workflow, condition reports and evidence, deposit settlement, notifications, proof uploads, and Sepolia document-hash anchoring.

## Initialization changes

- New repository identity and English setup documentation.
- A placeholder-only environment template and strengthened ignore rules.
- Explicit database commands and a build command without automatic migrations.
- Type-aware linting scoped to TypeScript files so standalone JavaScript configuration files remain lintable without a TypeScript project-service error.
- A new-feature roadmap, architecture decisions, and feedback log.

## Planned hackathon additions (not delivered by the import)

Conversational state, evidence retrieval tools, source-linked evidence cards, confirmation-bound agent actions, synthetic demo data, private original-evidence storage, and reliable on-chain verification.

Use the baseline commit when reporting the changes made during the hackathon. Preserve this distinction in the demo and submission text.
