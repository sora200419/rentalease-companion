# Developer feedback and friction log

Record observations when they occur. Do not turn hypothetical issues or inherited code findings into claims about a newly tested SDK.

| Date | Tool / version | Task attempted | Expected | Observed | Severity | Workaround | Suggested improvement |
|---|---|---|---|---|---|---|---|

## Observed local-model friction

These observations are recorded in [LOCAL-MODEL.md](LOCAL-MODEL.md). They concern tested local inference, not Alexa+, AWS or an Amazon SDK.

- **Ollama / qwen3:4b, 2026-09-22:** cold inference exceeded the configured 45-second deadline while warm English calls took roughly 1–1.8 seconds. The app used a visible rule fallback. The cold run failed its evaluation and was not reported as passing. Clearer readiness/progress signals before the first question would help.
- **Evidence interpretation:** an answer cited an available source but added a “new scuff” interpretation absent from the text. Citation validation alone did not establish factual correctness. The records workspace now uses optional AI for source-ID selection and renders exact source text; broader semantic evaluation remains necessary.
- **Action boundary:** liability/payment requests needed deterministic handling even when phrasing was indirect. Business amounts and confirmations remain outside model authority.

## Not yet evaluated

No formal Alexa+ runtime or Amazon SDK has been exercised. Do not present missing access, hypothetical concerns or inherited code findings as measured SDK feedback. The owner should review and supplement this log with their own observations before submission.
