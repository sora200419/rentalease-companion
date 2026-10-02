# Devpost submission draft — owner review required

Updated 2026-10-02 to match the independent three-item demo. This is a draft, not a submitted entry. Recheck the [official rules](https://amazonappdev2026.devpost.com/rules) before submission. The submission path was verified on 2026-09-28 as allowing an Alexa+ simulated web experience; formal runtime access is not claimed.

## Project name

RentalEase Move-Out Companion

## Elevator pitch

An evidence-led rental companion that helps tenants and landlords review deposit deductions, discuss each item, and confirm a clear, recorded outcome.

## About the project

### Inspiration

At the end of a tenancy, a deposit deduction can become a confusing exchange of photos, report notes and messages. RentalEase Move-Out Companion focuses on that moment: helping both people find the relevant record and understand which decision is still theirs to make.

### What it does

Built for the **Alexa+ track as a simulated web experience**, the companion brings source-cited evidence and confirmed actions into the same review. A tenant can dispute a deduction. A landlord can reply, withdraw it or propose a different amount. The tenant then accepts or rejects the available response. Each item is handled independently.

The independent `/demo` experience includes three deductions and labelled move-in/move-out photo pairs. It runs without private service credentials and offers standard, missing-baseline and conflicting-account scenarios. It retains decisions after refresh and asks for clarification when a request combines items or leaves an amount unclear. Proposals do not change the amount until accepted, and agreement never means a payment has been sent.

The separately authenticated records workspace also saves authorized decisions to Supabase, reads private evidence and exports a dated settlement summary. That workspace needs the owner's development configuration; it is not required to run the independent judge walkthrough.

### How it was built

The project uses Next.js, React and TypeScript, with Prisma, Supabase PostgreSQL and private Supabase Storage in the authenticated development workspace. NextAuth sessions establish the account role. Restricted database functions enforce state transitions, revision checks and retry safety after an explicit preview and confirmation.

The independent demo stores synthetic cases in local files and reuses the shared workflow, evidence and conservative English dialogue rules. Optional Ollama inference remains an earlier experiment for source selection in separate workspaces; it is not needed for `/demo`. Money and action authorization do not depend on model output.

The authenticated records conversation also uses a local MCP server and browser client built with the official TypeScript SDK. Six read-only tools expose authorized tenancy context, recorded agreements, deduction evidence, source-based answers and action previews. Saving remains a separate human-confirmed application action. This is local protocol integration, not a live Alexa+ connection.

### Challenges and lessons

The hardest boundary was keeping a plausible answer separate from an authorized action. A model can cite a real report and still add an unsupported interpretation, so the records workspace uses exact quotations and visible references. Another challenge was representing a revised proposal without prematurely changing the settlement total.

All 209 automated regressions passed in a clean source copy. Tests cover role separation, stale confirmations, retries, missing evidence and independent deduction decisions. The actual browser walkthrough retained ten confirmed events and a MYR 1,755 refund, and responsive layouts were checked at four widths. The demo uses synthetic roles and visibly labelled generated photos, not real tenant evidence.

### Existing work and hackathon additions

This project extends my RentalEase FYP codebase. Account roles, rental records, agreements and an earlier settlement workflow predate this hackathon work. The companion work adds the separate simulated experience, conversational context, confirmation-bound records actions, restricted Supabase development access, private evidence reading/linking, multi-item resolution and exported summaries. The baseline commit and boundaries are documented in the repository.

### What comes next

Broader accuracy and accessibility testing and production authorization come next. The independent demo already provides a locally runnable judge walkthrough. Formal Alexa+ integration is future work subject to access and validation. This prototype does not perform image analysis, legal adjudication, signatures or payments.

## Built with

Next.js, React, TypeScript, Node.js, Prisma, PostgreSQL, Supabase, NextAuth.js, MCP, Ollama.

Only retain Ollama in the final tags if demonstrating or documenting its tested optional use. MCP uses the official TypeScript SDK 1.30.1 in local records mode. Do not list Alexa SDK, Bedrock, Lambda or S3 as implemented technologies. Alexa+ is the target track, not an existing runtime integration.

## Links and media still required

- Repository: https://github.com/sora200419/rentalease-companion. Confirm the owner's rule-compliant source-access arrangement before submission. No collaborator access or licence change is implied by delivery of the code.
- A real video URL after recording/upload. Do not enter a placeholder or localhost as a public demo.
- Cover/gallery screenshots that visibly label the simulation and synthetic evidence.
- Reviewed developer feedback; [FRICTION_LOG.md](FRICTION_LOG.md) contains observed local-model limitations, not invented Amazon SDK usage.

Distinguish inherited work, new additions and future plans in the final submission. Do not select an AWS bonus solely because Supabase infrastructure may run on AWS; no new AWS service integration is claimed here.
