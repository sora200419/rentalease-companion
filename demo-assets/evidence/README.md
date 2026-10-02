# Synthetic evidence set

These four images were generated with the built-in imagegen tool on 2026-09-25 for the private RentalEase development demo. They are not photographs of a real tenancy and must never be submitted as real inspection evidence. Every image embeds `AI-GENERATED DEMO — NOT REAL EVIDENCE`.

| Files | Scenario | Intended fixture link |
| --- | --- | --- |
| `demo-wall-move-in-W01.png`, `demo-wall-move-out-W02.png` | Same staged wall scuff at both stages; lighting differs slightly. | `fixture-b-deduction` |
| `demo-kitchen-move-in-K01.png`, `demo-kitchen-move-out-K02.png` | Clean counter compared with staged crumbs and a coffee ring. | `fixture-b-cleaning` |

The images illustrate comparing sources, not an automated liability determination. A caption or upload date does not prove a capture time. These files have no evidential value outside this labelled simulation. No photo is invented for the key deduction; that scenario deliberately demonstrates a text-only decision.

Original generated PNGs are retained locally here, outside Next.js `public/`. Uploads in the demo use the normal authenticated, explicitly confirmed private-evidence workflow. See [generation prompts](PROMPTS.md).

The independent `/demo` walkthrough also reuses these exact files through a session-gated, allowlisted local route. It needs no Supabase upload or private storage credentials. These demonstration files must remain visibly labelled when used in screenshots or recordings.
