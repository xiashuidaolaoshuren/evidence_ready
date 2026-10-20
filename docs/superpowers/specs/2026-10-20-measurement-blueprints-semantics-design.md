# Measurement, blueprints, and field semantics

**Date:** 2026-10-20
**Status:** Agreed scope
**Sub-projects:** 3, 4, and 5 of 7, in that order. Richer inputs and persistence stay out of scope.

This records the grilling of roadmap items 3–5. It is the scope those sub-projects must satisfy. It is not an implementation plan. Domain vocabulary lives in [`CONTEXT.md`](../../../CONTEXT.md). The two decisions that change earlier architecture are [ADR 0007](../../adr/0007-bounded-semantic-check-may-confirm.md) and [ADR 0008](../../adr/0008-one-model-and-reviewed-sources.md).

Build 3 before 5. The harness records semantic failures. Field semantics changes verification so those failures no longer become confirmed values.

## 1. Decisions

| Decision | Choice |
| --- | --- |
| What a model change must protect | No new unsupported confirmation and no new invented or meaning-changing interview proposal. Coverage and speed may improve only inside that rule |
| Item 3 versus item 5 | Item 3 measures and records current semantic failures. Item 5 changes verification |
| Tasks in the harness | Extraction and answer interpretation, reported separately |
| Correctness | Human-reviewed expectations. Equivalent wording can pass. A model does not decide the expected answer |
| Regressions | Case by case. Fixing one failure cannot excuse a new unsupported confirmation or a new invented proposal |
| Evidence boundary | Explicitly cited passages must support the whole value. The cited page is read for qualifications, restrictions, and negation |
| Second category | Household, mains-powered pop-up bread toaster |
| Who selects the category | The user. One category and one product model per dossier |
| Mixed uploads | Judge each document. Accepted documents can proceed. A flagged source blocks readiness until reviewed |
| Absence, silence, and non-applicability | An explicit "no" is a value. Silence is missing. Only a blueprint condition can make a field not applicable |
| Prose and lists | Distinct prose and distinct complete accounts require review. Additive lists accumulate supported items. The blueprint says which kind a field is |
| Partial support | The original candidate stays unverified. A narrower value is a separate candidate and must itself verify |
| Semantic check | May authorize confirmation after its own benchmark. Uncertainty stays unverified |
| Readiness | Essential disagreements and unresolved source reviews block it. Supporting disagreements do not. Operating steps stay supporting |
| Time to readiness | Report model latency and scripted review workload now. Do not claim a change in human completion time until a user exercise is run |

## 2. Sub-project 3 — model harness and metrics

### Goals

- Compare a pinned model and prompt against human-reviewed expectations for extraction and for interpretation of interview answers.
- Judge value correctness separately from citation support.
- Keep a recorded response path for routine checks. A fresh model run is an explicit evaluation, stored with the model, prompt, settings, and response.
- Use a starter suite of 12 document sets and 24 interview answers, each run three times. Hold some cases out of prompt tuning.
- Mix controlled synthetic cases with legally usable real documents. Report those results separately. Private supplier material stays out unless its use is authorized.
- Record known failures individually. A replacement may replace the baseline only when each previously recorded failure is fixed. A new unsupported confirmation, or a proposal that invents a detail or changes the user's meaning, blocks acceptance.
- After those safety checks, correct essential-field coverage and faithful interview proposals must meet or exceed the baseline.
- Report latency and the review actions a fixed script would require. Human time to readiness is a separate measurement and is not required to finish this sub-project.

The suite is a regression benchmark. It does not estimate a real-world error rate.

### Non-goals

- Shipping semantic verification. That is sub-project 5.
- A human timing study.
- A compliance or completeness score.

## 3. Sub-project 4 — multi-category blueprints

### Goals

- Add a toaster blueprint beside the kettle blueprint. Prompts, question ranking, and readiness follow the selected blueprint.
- Cover household, mains-powered pop-up bread toasters. A toaster oven or a commercial conveyor toaster is the wrong category, not a toaster with missing fields.
- Let the user select the category. The model may flag a mismatch and must not change the category.
- Keep one product model per dossier. A source contributes model-specific facts only when its connection to that model is established. Family instructions contribute only where they explicitly apply.
- Assess documents individually. A category-neutral source may support shared facts. A flagged source stays out of extraction until the user excludes it or accepts it for use.
- Continue extraction from accepted documents. Unresolved source review blocks authoring readiness.
- Use nine essential toaster fields: product name, model identifier, manufacturer or supplier, importer or responsible-party contact, rated voltage, rated frequency, rated power, intended use, and slot count.
- Treat slot count as the number of bread openings. Slice capacity is a different fact and is not essential.

These fields are workflow requirements for this project, not legal requirements.

### Non-goals

- A third category.
- Multi-model dossiers.
- Changing kettle operating steps, or toaster operating steps, into essential fields.

## 4. Sub-project 5 — field semantics

### Goals

- Require evidence, as defined in `CONTEXT.md`: located passages that support the whole value, read with qualifications on the cited page.
- Qualify a semantic check on its own reviewed set before it may authorize confirmation: no false acceptance across the three runs, and at least 90 percent acceptance of supported claims in each category. Those are release criteria for that set, not a claim about unseen documents.
- Measure the semantic check separately from extraction and answer interpretation.
- Keep an explicit negative value, a missing value, and a not-applicable field distinct.
- Derive non-applicability only from a blueprint condition whose prerequisite is document-supported or user-confirmed. A missing or conflicting prerequisite leaves applicability unresolved.
- Include two supporting toaster fields as the first condition: whether a defrost function is present, and the defrost operating instructions. Instructions apply only when presence is yes. If that answer later changes, reassess the instructions and keep the earlier history.
- Require review of differing accounts on prose and on complete accounts. Merge only fields the blueprint marks as additive lists.
- Leave a partially supported candidate unverified, with its wording and the reason. Do not trim it into a confirmed value.
- Resolve essential disagreements through the interview. Supporting disagreements stay visible and do not block readiness.

### Non-goals

- Letting the user mark an arbitrary field not applicable.
- A second model judgment that silently treats a paraphrase as agreement.
- Confirming the supported part of a candidate by editing that candidate in place.

## 5. Still open

These need a later specification pass. They do not reopen the decisions in section 1.

- Which of the 12 document sets and 24 answers are held out of prompt tuning, and the exact cases in the semantic-check safety set.
- Which real documents are legally usable, and where private material is stored.
- How a human-reviewed expectation records acceptable wording without becoming an exact-output fixture.
- The toaster supporting-field catalog beyond operating steps, which stay supporting, and the defrost pair.
- The kettle and toaster fields that are additive lists rather than complete accounts.
- The citation shape for more than one passage, and the field-status representation of not applicable.
