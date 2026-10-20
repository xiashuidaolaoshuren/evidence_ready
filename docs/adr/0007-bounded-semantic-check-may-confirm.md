---
status: accepted
date: 2026-10-20
---

# Let a bounded semantic check authorize confirmation

Finding a quote on a page proves the passage exists. It does not prove the passage supports the extracted value. A human-reviewed semantic check may turn a located citation into evidence when the cited passages support the whole value. An uncertain or unsupported result leaves the candidate unverified. The application still owns fields, applicability, and readiness.

## Considered Options

- **Bounded semantic check (chosen).** The passages must first be found on the named page. The check then decides whether those passages, read with the qualifications on that page, support every claim in the value. Page context may disqualify a misleading excerpt. It cannot supply an uncited claim. The check may authorize confirmation only after a reviewed safety set shows no false acceptance across repeated runs, and supported claims are accepted often enough to be useful.
- **Advisory only.** The model may warn, but only a deterministic check can confirm. Prose that cannot be checked that way stays user-provided. This keeps model judgment out of confirmation and makes automatic confirmation much rarer.
- **Treat the page or the document as support.** Fewer citation failures, and a writer can no longer see which passages justify the value.

## Consequences

This narrows [ADR 0002](./0002-deterministic-control-of-llm.md). The model may participate in confirmation, and only through this check. It still may not invent fields, phrase questions, resolve disagreements, write to the dossier without confirmation of a proposal, or decide readiness.

Sub-project 3 measures semantic failures against human-reviewed expectations before this check ships. A known failure stays in the baseline until sub-project 5 changes verification. A checker that rejects every claim fails the usefulness bar even though it creates no false confirmation. Passing the benchmark describes that benchmark, not unseen documents.
