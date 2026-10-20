# Implementation plan: Measurement, blueprints, and field semantics

**Spec:** [docs/superpowers/specs/2026-10-20-measurement-blueprints-semantics-design.md](../specs/2026-10-20-measurement-blueprints-semantics-design.md)
**Created:** 2026-10-20
**Goal scope:** One ordered sequence. Measure model behavior, then add the pop-up toaster blueprint and source review, then change what confirmation and disagreement mean. These share the dossier and readiness path, so they are one plan rather than three specs.

## Summary

Sub-project 3 adds a human-reviewed benchmark for extraction and answer interpretation. It records today's semantic failures and blocks a model replacement that adds an unsupported confirmation or an invented proposal. Sub-project 4 adds a user-selected household pop-up toaster blueprint, one product model per dossier, and per-document source review that can block readiness. Sub-project 5 then distinguishes support from quote presence, differing accounts from scalar conflicts, and not-applicable from missing. A semantic model check may authorize confirmation only after its own qualification record passes.

Out of scope: richer inputs, persistence, accounts, a third category, multi-model dossiers, a human timing study, and any claim of real-world error rates or legal compliance. The committed starter suite may be synthetic. The runner must label that run `synthetic-only` until an authorized real document is present. Shipping the suite does not require a real document whose rights are still undecided.

Confirmation stays the current quote-presence check through T8. T9 is the only subtask that may let a support verdict confirm a value.

## Discovery notes

- **Reuse:** `runExtraction` in `src/server/pipeline.ts`; `extractCandidates` and `interpretAnswer` in `src/server/model.ts`; `verifyCitation` in `src/domain/verify.ts`; `reconcileCandidates`; `authoringReadiness`; `nextQuestion`; `applyEvent`; `KETTLE_FIELDS` and `essentialKeys()` in `src/domain/fields.ts`; session version 2 in `src/state/session.ts`; recorded fixtures in `fixtures/kettle/`. Domain tests sit beside the module and run under Vitest.
- **Constraints:** The model does not invent fields, phrase questions, resolve disagreements, or decide readiness ([ADR 0002](../../adr/0002-deterministic-control-of-llm.md), narrowed by [ADR 0007](../../adr/0007-bounded-semantic-check-may-confirm.md)). One category and one model per dossier ([ADR 0008](../../adr/0008-one-model-and-reviewed-sources.md)). Supporting disagreements do not block readiness. `essentialKeys()` currently closes over the kettle table, and session restore rejects a dossier whose keys are not exactly that table.
- **Patterns to follow:** Pure domain functions, Zod at the session and model boundary, handler factories in `src/server/http/`, screen tests with Testing Library. Keep `KETTLE_FIELDS` in `src/domain/fields.ts` rather than splitting the file.
- **Anti-goals:** No drive-by refactor of the pipeline stages, model transport, or interview budget. No semantic confirmation before the qualification gate. No automatic category switch. No trimming of a partially supported candidate into a confirmed value.

## File map

### Goal: benchmark

| Path | Create/Modify | Responsibility | Public surface | Verified/Provisional |
|------|---------------|----------------|----------------|---------------------|
| `src/domain/benchmark/types.ts` | create | Expectation, observation, and report shapes | `CaseExpectation`, `ObservedExtraction`, `ObservedInterpretation`, `CaseComparison` | provisional |
| `src/domain/benchmark/compare.ts` | create | Score one case and apply the replacement rule | `compareCase`, `acceptReplacement` | provisional |
| `src/domain/benchmark/workload.ts` | create | Count scripted field reviews and source reviews | `scriptedReviewWorkload` | provisional |
| `benchmarks/run-recorded.ts` | create | Score recorded outputs without a model call | CLI `npm run benchmark:recorded` | provisional |
| `benchmarks/cases/` | create | The 12 document sets and 24 answers, each tagged | JSON cases, `holdout` and `origin` fields | provisional |
| `benchmarks/run-fresh.ts` | create | Three live runs, stored with model, prompt, settings, and response | CLI `npm run benchmark:fresh` | provisional |
| `benchmarks/runs/` | create | Gitignored fresh-run artifacts | run directories | provisional |
| `package.json` | modify | Add the two benchmark scripts | `benchmark:recorded`, `benchmark:fresh` | verified |

### Goal: blueprints and source review

| Path | Create/Modify | Responsibility | Public surface | Verified/Provisional |
|------|---------------|----------------|----------------|---------------------|
| `src/domain/fields.ts` | modify | Both blueprints and the registry | `FieldDefinition`, `KETTLE_FIELDS`, `TOASTER_FIELDS`, `blueprintFor`, `essentialKeys(fields)` | verified file; toaster export provisional |
| `src/domain/source-fit.ts` | create | Per-document category and model fit | `assessSource`, `SourceAssessment` | provisional |
| `src/domain/prompt.ts` | modify | Build the catalog from the selected blueprint | `extractionPrompt`, `interpretPrompt` gain `fields` | verified |
| `src/domain/planner.ts` | modify | Rank fields from the selected blueprint | `nextQuestion` | verified |
| `src/domain/coverage.ts` | modify | Coverage for the selected blueprint | `assessCoverage(dossier, fields)` | verified |
| `src/domain/readiness.ts` | modify | Add unresolved source review as a blocker | `authoringReadiness(dossier, input)` | verified |
| `src/server/pipeline.ts` | modify | Extract only from documents accepted for this run | `runExtraction` | verified |
| `src/screens/Intake.tsx` | modify | The user selects the category before extraction | `Intake` | verified |
| `src/state/session.ts` | modify | Persist category, model identity, and source reviews | `SESSION_VERSION` 3 | verified |
| `src/state/app-state.ts` | modify | Carry the blueprint and source reviews through the interview | `AppState` | verified |

### Goal: field semantics

| Path | Create/Modify | Responsibility | Public surface | Verified/Provisional |
|------|---------------|----------------|----------------|---------------------|
| `src/domain/types.ts` | modify | Passages, not-applicable status, list policy | `Citation.quotes`, `FieldStatus` includes `not-applicable` | verified file; new members provisional |
| `src/domain/applicability.ts` | create | Derive not-applicable from a resolved prerequisite | `applyApplicability` | provisional |
| `src/domain/reconcile.ts` | modify | Differing accounts, additive lists, and complete accounts | `reconcileCandidates` | verified |
| `src/domain/verify.ts` | modify | Every cited passage must occur on the named page | `verifyCitation` | verified |
| `src/domain/support.ts` | create | Apply a support verdict without calling a model | `applySupportVerdict` | provisional |
| `src/server/semantic-check.ts` | create | Ask the model whether the located passages support the value | `checkSupport` | provisional |
| `src/domain/schemas.ts` | modify | Accept the new citation and status shapes | `dossierFieldSchema` | verified |
| `src/state/session.ts` | modify | Read version 3 and write version 4 once passages exist | `SESSION_VERSION` 4 | verified |
| `src/screens/DossierPanel.tsx` | modify | Show not-applicable, differing accounts, and partial support | `DossierPanel` | verified |
| `src/screens/ReadinessReport.tsx` | modify | Show a source-review blocker separately from field blockers | `ReadinessReport` | verified |

### Blast radius

| Path | Why sensitive | Behavior that must stay intact |
|------|----------------|-------------------------------|
| `src/domain/fields.ts` | Prompts, planner, coverage, readiness, and session restore all read it | The kettle essential keys stay `product-name`, `model-identifier`, `manufacturer-or-supplier`, `importer-contact`, `rated-voltage`, `rated-frequency`, `rated-power`, `capacity`, `intended-use`, in that order. `essentialKeys` takes the field table and has no kettle default |
| `src/domain/verify.ts` | Confirmation depends on it until T9 | A single quote that occurs on the named page still verifies. T8 requires every passage to occur; it does not yet judge support |
| `src/domain/reconcile.ts` | The bundled kettle conflict comes from here | The recorded 1.5 L / 1.7 L capacity pair remains one scalar conflict. Kettle prose still confirms from the first located candidate until T8 |
| `src/server/pipeline.ts` | Live and recorded extraction share it | Recorded mode still reads `fixtures/kettle/` and makes no model call. Abort, deadline, text budget, and per-file PDF failures stay |
| `src/state/session.ts` | Seven-day browser sessions | A version 2 session restores as category `kettle`. An unknown version still shows the existing restore notice |
| `src/domain/readiness.ts` | The report's verdict | A supporting conflict still does not block. A missing, conflicting, or unverified essential still does |

## Workflow (for implementers)

1. **writing-plans** produced this file (type-1 decomposition).
2. Per subtask: Plan mode and **planning-subtasks** when **Plan mode** is `high`, or `medium` and the named unknown is still open.
3. Agent mode uses **test-driven-development** when **`TDD suitable: yes`**, or on the testable slice of **`partial`**. A `no` subtask follows **Verification** only.
4. An equivalent internal change is recorded in the changelog and implementation continues. A split, a merge, or a material change updates this file first. Material changes wait for agreement.

## Subtasks

Dependency notation: `Blocked by: T1` means start after T1 is done.

### T1 — Compare a run with a reviewed expectation

- [ ] **Do:** Score one extraction or interpretation observation against a human-reviewed expectation, with value correctness separate from citation support, and apply the replacement rule across cases.
- **Consumes:** none
- **Produces:** `compareCase` and `acceptReplacement`. An expectation lists acceptable normalized values, not one exact string. Each known semantic failure has a stable id. `compareCase` returns value failures, support failures, invented-proposal failures, and whether the case is a known failure. `acceptReplacement` returns `accepted: false` when any new unsupported confirmation or invented proposal appears, when any baseline failure id remains, or when essential-field coverage or faithful-proposal coverage is below the baseline. Those coverages are counts of cases, compared only after the safety checks pass.
- **Acceptance:** Equivalent reviewed wording matches. An unseen wording mismatches. A quote that is present but marked unsupported is a support failure, not a value failure. Removing one known failure while adding another still fails replacement. A run with no candidates fails replacement on coverage even though it adds no unsupported confirmation. Interpretation that adds a detail absent from the answer is an invented proposal. Interpretation that omits a volunteered detail lowers faithful-proposal coverage and is not, by itself, an invented proposal.
- **Blocked by:** —
- **Plan mode:** skip
- **TDD suitable:** yes
- **Verification:** `npx vitest run src/domain/benchmark/compare.test.ts`

### T2 — Replay recorded cases and report the two tasks

- [ ] **Do:** Add a recorded runner that scores committed model outputs with T1 and prints extraction and interpretation separately.
- **Consumes:** `compareCase`
- **Produces:** `scriptedReviewWorkload` and `npm run benchmark:recorded`. The report separates extraction from interpretation, tuning cases from holdout cases, and `synthetic` from `real`. With no real case it prints `synthetic-only`. It includes model latency only when a stored duration exists, plus the workload count: essential field reviews the planner would still ask, and flagged sources still awaiting review. It does not print a human completion time. Holdout case ids are absent from the prompt unit fixtures.
- **Acceptance:** The runner makes no network call. A changed recorded output changes the report. A holdout case is scored and listed apart from tuning cases. Zero real cases produce `synthetic-only` and exit 0 when the recorded outputs match. A drift from the committed score exits non-zero.
- **Compatibility:** `npm test` does not call this runner and does not require a model key.
- **Blocked by:** T1
- **Plan mode:** skip
- **TDD suitable:** yes
- **Verification:** `npx vitest run src/domain/benchmark/workload.test.ts benchmarks/run-recorded.test.ts`

### T3 — Write the starter case catalog

- [ ] **Do:** Add the 12 document sets and 24 interview answers the recorded runner scores, including the known semantic failures item 5 is expected to fix.
- **Consumes:** the case shape from T2
- **Produces:** `benchmarks/cases/`. Each case has `origin`, `holdout`, and a category. The committed baseline names each known failure id. At least one held-out extraction case and one held-out interpretation case are included.
- **Acceptance:** The counts are 12 and 24. The current recorded kettle operating-steps candidate, whose quote covers only the last step, is a known support failure, not an acceptable supported value. An answer that states an importer city does not authorize a street address. An answer of "I don't know" does not authorize a negative value. The report says `synthetic-only` unless an authorized real file is actually present. Real files, if added later, live outside git unless their use is authorized.
- **Blocked by:** T2
- **Plan mode:** high
- **TDD suitable:** no
- **TDD suitable reason:** The catalog is reviewed declarative data. The runner's tests already lock how a case is scored.
- **Verification:** `npm run benchmark:recorded` exits 0 and prints 12 extraction cases, 24 interpretation cases, and `synthetic-only`.

### T4 — Capture a fresh evaluation without changing the baseline

- [ ] **Do:** Add an explicit fresh-run command that calls the pinned model three times per case and stores the model, prompt, settings, response, and latency.
- **Consumes:** `compareCase`, `acceptReplacement`, `benchmarks/cases/`
- **Produces:** `npm run benchmark:fresh`. Artifacts go to gitignored `benchmarks/runs/`. The command prints the replacement decision and does not overwrite the committed baseline.
- **Acceptance:** A fake transport records three calls per case and a complete artifact. A missing API key fails before any partial run is treated as a result. The committed baseline is unchanged after a run. Promoting a run to the baseline is a separate human commit, not an output of the command.
- **Compatibility:** `npm test` and `benchmark:recorded` still make no model call.
- **Blocked by:** T3
- **Plan mode:** skip
- **TDD suitable:** partial
- **TDD suitable reason:** Artifact writing and the replacement decision are testable with a fake transport. A real three-run evaluation is manual and is not required to finish the command.
- **Verification:** `npx vitest run benchmarks/run-fresh.test.ts`. Manual check: `npm run benchmark:fresh` without a key exits non-zero and writes no run directory.

### T5 — Add the toaster blueprint without changing kettle readiness

- [ ] **Do:** Make prompts, ranking, coverage, and readiness take a field table, and add the pop-up toaster table beside the kettle table.
- **Consumes:** none from the benchmark
- **Produces:** `blueprintFor("kettle" | "pop-up-toaster")`, `essentialKeys(fields)`, `KETTLE_FIELDS`, and `TOASTER_FIELDS`. Toaster essentials are `product-name`, `model-identifier`, `manufacturer-or-supplier`, `importer-contact`, `rated-voltage`, `rated-frequency`, `rated-power`, `intended-use`, and `slot-count`, in that order. `slot-count` is the number of bread openings. Slice capacity is a separate supporting field. Operating steps stay supporting. Supporting fields include `defrost-present` and `defrost-instructions`. Every list field declares `listPolicy: "additive" | "complete-account"`. `defrost-instructions` declares `applicability: { prerequisiteKey: "defrost-present", applicableWhen: "yes" }`.
- **Acceptance:** A toaster table passed to coverage and readiness does not require kettle capacity. A kettle dossier still has the same nine essential keys and the same ready or needs-review result as before. No toaster field beyond the nine essentials is essential. A toaster-oven or conveyor description is not represented by an extra essential field.
- **Compatibility:** Existing kettle tests keep their verdicts. `KETTLE_FIELDS` remains exported from `src/domain/fields.ts`.
- **Blocked by:** T4
- **Plan mode:** high. The remaining toaster supporting-field keys, and which list fields are additive or complete accounts, are still open. They stay supporting and cannot change the nine essentials.
- **TDD suitable:** yes
- **Verification:** `npx vitest run src/domain/fields.test.ts src/domain/coverage.test.ts src/domain/readiness.test.ts src/domain/planner.test.ts src/domain/prompt.test.ts`

### T6 — Judge each source and block readiness while a flag is open

- [ ] **Do:** Classify each document against the selected category and the dossier's one product model, and make an unresolved flag a readiness blocker.
- **Consumes:** `blueprintFor`, `FieldDefinition`
- **Produces:** `assessSource`, returning `accepted`, `category-neutral`, or `flagged`. `authoringReadiness` gains a source-review blocker that is distinct from a field blocker. A flagged document is not evidence for extraction. An accepted or category-neutral document may be.
- **Acceptance:** A kettle manual in a toaster dossier is flagged, and a supplier contact sheet with no category is category-neutral. Two pop-up toaster models in one dossier flag the document that names the other model. A family instruction is accepted only where it explicitly applies to the selected model. An uncertain classification is flagged. Resolving every essential field while a flag remains still returns `needs-review`. A supporting-field disagreement does not. Accepting a source removes the blocker and does not mark its extracted values confirmed.
- **Compatibility:** With no flagged sources, kettle readiness verdicts stay the same.
- **Blocked by:** T5
- **Plan mode:** high. The open question is how a document is judged before the dossier has a confirmed model identifier. The acceptance cases above still hold.
- **TDD suitable:** yes
- **Verification:** `npx vitest run src/domain/source-fit.test.ts src/domain/readiness.test.ts`

### T7 — Run intake, extraction, and the interview from the selected blueprint

- [ ] **Do:** Let the user select kettle or pop-up toaster, persist that choice, and run prompts, extraction, questions, and readiness from it.
- **Consumes:** `blueprintFor`, `assessSource`, the source-review blocker from T6
- **Produces:** session version 3. A version 2 session loads as `kettle`. New sessions store `category`, the product-model identity, and each source review. `runExtraction` receives the accepted document ids and skips flagged documents. The model may propose a mismatch flag and cannot change `category`.
- **Acceptance:** Choosing toaster and uploading a toaster specification extracts against `TOASTER_FIELDS`. A mixed upload still extracts from the accepted toaster document. The report stays needs-review until the flagged document is excluded or accepted. The recorded kettle path still reaches the same readiness result. Refreshing a version 2 kettle session restores it. A version 3 toaster session restores the toaster fields rather than the kettle table.
- **Compatibility:** Recorded mode makes no model call. Session expiry, the seven-day retention, and the quota warning stay as they are.
- **Blocked by:** T6
- **Plan mode:** high
- **TDD suitable:** partial
- **TDD suitable reason:** Session, pipeline, and readiness behavior are test-first. The intake control's layout is a manual check.
- **Verification:** `npx vitest run src/state/session.test.ts src/server/pipeline.test.ts src/screens/Intake.test.tsx src/screens/ReadinessReport.test.tsx`, then `npm run test:e2e -- e2e/recorded-kettle.spec.ts`. Manually select toaster, add a matching document and a kettle document, and confirm the kettle document stays out of extraction until reviewed.

### T8 — Apply disagreement, list policy, and non-applicability

- [ ] **Do:** Change reconciliation so prose and complete accounts that differ require review, additive lists combine, and a blueprint condition can make a field not applicable.
- **Consumes:** `listPolicy` and `applicability` on `FieldDefinition`; `defrost-present` and `defrost-instructions`
- **Produces:** `Citation.quotes`, field status `not-applicable`, and `applyApplicability`. Session version 4 reads a version 3 `quote` as `quotes: [quote]`. `verifyCitation` succeeds only when every quote occurs on the named page. Prose and `complete-account` lists become differing accounts when their normalized values differ. `additive` lists union supported items. `not-applicable` is not missing and is not a blocker. The planner does not ask a not-applicable field.
- **Acceptance:** "Domestic water boiling" and "boiling water for household use" still require review when both appear, because no model judgment may dismiss the difference. An explicit "no" for defrost presence is a value. Silence on defrost presence stays missing, and the instruction field stays unresolved rather than not applicable. A confirmed or user-provided "no" makes the instruction field not applicable and keeps the prior value in history when the prerequisite later changes. Two different operating sequences stay separate. Two material lists marked additive combine. A candidate with two quotes is rejected when either quote is absent. A supporting differing account is visible and does not block readiness. An essential differing account does.
- **Compatibility:** The recorded kettle capacity conflict remains a scalar conflict. Quote presence still decides confirmation. This subtask must not call the semantic check.
- **Blocked by:** T7
- **Plan mode:** medium. The named unknown is how a version 3 `quote` and `surroundingWindow` migrate to version 4 passages.
- **TDD suitable:** yes
- **Verification:** `npx vitest run src/domain/verify.test.ts src/domain/reconcile.test.ts src/domain/applicability.test.ts src/domain/readiness.test.ts src/domain/planner.test.ts src/state/session.test.ts`

### T9 — Let a qualified support check authorize confirmation

- [ ] **Do:** Add the semantic support check and let it confirm a value only when a qualification record says it passed.
- **Consumes:** `compareCase`, `Citation.quotes`, `verifyCitation`
- **Produces:** `checkSupport` and `applySupportVerdict`. The verdict is `supports`, `partial`, `unsupported`, or `uncertain`. The cited page is available to the check for restrictions, conditions, and negation. A passage outside the cited quotes cannot add a claim. `applySupportVerdict` confirms only on `supports` after location has succeeded, and only when the qualification record passes. `partial` leaves the original candidate unverified with its wording and reason. A narrower value is a separate candidate and must pass location and support on its own. `unsupported` and `uncertain` stay unverified.
- **Acceptance:** Without a passing qualification record, a located quote confirms exactly as it did before T9. A passing record confirms a fully supported value and rejects a quote contradicted by the same page. A checker that returns `partial` does not rewrite the original candidate into the narrower value. The qualification set is scored apart from extraction and interpretation: zero false acceptances across three runs, and at least 90 percent of supported claims accepted in each category. A record that misses either bar does not authorize confirmation. The benchmark states that this is the reviewed set, not unseen documents.
- **Compatibility:** Fields, applicability, disagreement review, and readiness remain application-owned. The model still cannot invent a field or mark an arbitrary field not applicable.
- **Blocked by:** T8
- **Plan mode:** high
- **TDD suitable:** partial
- **TDD suitable reason:** Verdict application is test-first with a stub checker. The live qualification run is manual, and a passing record must not be invented to make the suite green.
- **Verification:** `npx vitest run src/domain/support.test.ts src/server/semantic-check.test.ts src/server/pipeline.test.ts`. Manual check: run the qualification command three times and confirm the pipeline still ignores support verdicts when the written record fails either bar.

## TDD note (Agent mode)

Per subtask, obey **`TDD suitable`**. **`yes`** means strict red/green/refactor. **`partial`** applies that only to the testable slice. **`no`** follows **Verification** and does not add a token failing test for declarative cases. A behavior-preserving kettle path is a stay-green edit when a test already pins it.

## Plan changelog

| Date | Change | Kind |
|------|--------|------|
| 2026-10-20 | Initial plan | — |
