# Implementation plan: Quality baseline

**Spec:** [docs/superpowers/specs/2026-10-10-quality-baseline-design.md](../specs/2026-10-10-quality-baseline-design.md)
**Created:** 2026-10-10
**Goal scope:** Close the coarse live-error, untested-screen, and prototype-drift limitations, and finish the leftover `server/` move. One coherent baseline, not a new product feature.

## Summary

Review the current tree and log real bugs, move the remaining server modules under `src/server/`, then replace the live-model error codes and recovery actions from spec §4. Fix review bugs one failing test at a time, add the named missing tests, match the listed screens to the prototype, and publish `docs/limitations.md`. Out of scope: a model harness, field semantics, new categories, richer inputs, persistence, accounts, a coverage gate, pixel snapshots, and any edit to `PROPOSAL.md`.

## Discovery notes

- **Reuse:** `ModelError` and `mapTransportError` in `server/model.ts`; `mapModelError` and `mapExtractionStreamError`; `errorRecoveryAction`; `ExtractionProgress` recovery cards; `createInterpretHandler` already turns a `malformed` model error into HTTP `rephrase`; `jsonError` already spreads extra error fields; `ApiError` / SSE `error` events; `TextTooLargeError` and `ExtractionTimeoutError`; the public-demo `live-unavailable` responses; `prototype/DESIGN.md` and `prototype/evidenceready-prototype-v2.html` (gitignored, present in this checkout); `src/app/globals.css` already binds the six core tokens.
- **Constraints:** OpenRouter `error.metadata.error_type` wins over HTTP status. `Retry-After` is capped at 120 seconds. No automatic second model request. Interview failures stay on the question. Unknown recovery codes go back to intake. The move keeps each file's current import style, including whether it uses a `.js` suffix. `src/server/http/*` currently imports `../../../server/...` without a suffix. `server/*.test.ts` uses `.js`.
- **Patterns to follow:** Route handlers are factories tested with `new Request`. Domain and screen tests are Vitest plus Testing Library. One Playwright smoke already walks the recorded kettle path on the public demo.
- **Anti-goals:** Do not treat the known `gemini-unavailable` / `quota` / HTTP-403-as-`auth` behaviour as a review bug. Spec §4 replaces it. Do not merge duplicate modules by hand before the move. Do not restyle screens the prototype does not show, and do not reveal the public demo's hidden live and upload controls.

## File map

### Goal: review record

| Path | Create/Modify | Responsibility | Public surface | Verified/Provisional |
|------|---------------|----------------|----------------|---------------------|
| `docs/implementation-issues.md` | modify | Append this review's bugs and deferred findings | markdown entries | verified |

### Goal: server layout

| Path | Create/Modify | Responsibility | Public surface | Verified/Provisional |
|------|---------------|----------------|----------------|---------------------|
| `server/model.ts` | modify, then move to `src/server/model.ts` | Model transport, repair, `ModelError` | `ModelError`, `createDefaultTransport`, `extractCandidates`, `interpretAnswer`, `prepareModelLogEvent` | verified |
| `server/pipeline.ts` | move to `src/server/pipeline.ts` | Extraction pipeline | `runExtraction`, `TextTooLargeError`, `ExtractionTimeoutError` | verified |
| `server/pdf.ts` | move to `src/server/pdf.ts` | Page text extraction | `extractPages`, `PdfExtractError` | verified |
| `server/intake.ts` | move to `src/server/intake.ts` | Upload validation | `validateIntakeUploads` | verified |
| `server/*.test.ts` | move beside the modules under `src/server/` | Existing pipeline, model, pdf, and intake tests | — | verified |
| `src/server/model.test.ts` | modify | Logging tests already under `src/server/` | — | verified |
| `src/server/pipeline.test.ts` | modify | Deadline and text-budget tests already under `src/server/` | — | verified |
| `src/server/http/*.ts` | modify | Import pipeline, model, and pdf from `src/server/` | unchanged handler factories | verified |
| `vitest.config.ts` | modify | Drop the `server/**/*.test.ts` include | Vitest include | verified |

### Goal: live model errors

| Path | Create/Modify | Responsibility | Public surface | Verified/Provisional |
|------|---------------|----------------|----------------|---------------------|
| `src/server/model-failure.ts` | create | Map an OpenRouter failure to one app code, message, and optional wait | `classifyModelFailure`, `ModelFailureCode`, `ModelFailure` | provisional |
| `src/server/model.ts` | modify | Throw classified `ModelError`s. Skip repair when HTTP 200 is an error object | `ModelError.retryAfterSeconds` | verified |
| `src/server/http/map-model-error.ts` | modify | JSON status from the code table | `mapModelError` | verified |
| `src/server/http/map-stream-error.ts` | modify | SSE error payload, including `retryAfterSeconds` | `mapExtractionStreamError` | verified |
| `src/server/http/types.ts` | modify | Error object may carry `retryAfterSeconds` | `ApiErrorBody` | verified |
| `src/server/http/createInterpretHandler.ts` | modify | Keep `malformed` as `rephrase`. Pass other classified codes through | `createInterpretHandler` | verified |
| `src/api.ts` | modify | Carry `retryAfterSeconds` from JSON and SSE into `ApiError` | `ApiError`, `ProgressEvent` | verified |
| `src/screens/extraction-errors.ts` | modify | Closed recovery table | `errorRecoveryAction` returns `retry` \| `use-recorded` \| `back-to-intake` | verified |
| `src/screens/ExtractionProgress.tsx` | modify | One button per recovery action. Disable Retry during the wait | `ExtractionProgress` | verified |
| `src/screens/InterviewWorkspace.tsx` | modify | Cause-specific interpret copy | `INTERPRET_ONE_FIELD_SENTENCE` | provisional export name |

### Goal: named tests, prototype, limitations

| Path | Create/Modify | Responsibility | Public surface | Verified/Provisional |
|------|---------------|----------------|----------------|---------------------|
| `src/screens/BudgetPause.test.tsx` | create | Continue and finish | — | provisional |
| `src/screens/SourceDrawer.test.tsx` | create | Open content and close | — | provisional |
| `src/components/ModeBadge.test.tsx` | create | Recorded and live labels | — | provisional |
| `src/components/AppChrome.test.tsx` | create | Restart only after intake; storage warning | — | provisional |
| `src/components/AppShell.test.tsx` | create | Active phase screen inside the provider | — | provisional |
| `src/server/http/createExtractHandler.live-path.test.ts` | create | Factory plus real pipeline, fake transport, no network | — | provisional |
| `src/app/globals.css` | modify | Only if a token or layout rule drifts from `DESIGN.md` | CSS variables | verified |
| `src/screens/*.tsx`, `src/components/AppChrome.tsx` | modify | Spacing, type, and layout that disagree with the prototype | existing components | verified |
| `docs/design/quality-baseline/` | create | Before and after screenshots | png files | provisional |
| `e2e/recorded-kettle.spec.ts` | modify | Keyboard path, history, restart | Playwright | verified |
| `docs/limitations.md` | create | Current limitations, open or resolved | markdown | provisional |
| `README.md` | modify | Link the limitations doc; drop the assessor sentence | — | verified |

### Blast radius

| Path | Why sensitive | Behavior that must stay intact |
|------|----------------|-------------------------------|
| `server/model.ts` | Every live extract and interpret call | Recorded extraction makes no model call. Repair still runs when assistant content is non-empty and is not JSON. Deployed logs stay metadata-only |
| `src/server/http/map-stream-error.ts` | SSE errors are the extract failure contract | `extraction-timeout`, pipeline `text-too-large`, `all-sources-failed`, and `PdfExtractError` codes stay. A fixture `SyntaxError` stays `internal-error`, not `invalid-request` |
| `src/server/http/createInterpretHandler.ts` | Interview depends on `rephrase` | `malformed` model JSON is still HTTP 400 `rephrase` with `Could not interpret the answer. Please rephrase.` Public demo still returns `live-unavailable` |
| `src/screens/extraction-errors.ts` | Every failed extraction screen | Restart session still returns to intake. Use recorded starts the bundled example, not the user's files |
| `src/state/SessionProvider.tsx` | Not edited by this plan unless a review bug requires it | Phase, URL sync, cancellation, and session v2 stay as they are |

## Workflow (for implementers)

1. **writing-plans** produced this file (type-1 decomposition).
2. Per subtask: **Plan mode** + **planning-subtasks** → type-2 plan when **Plan mode** is `high` (or `medium` with a real remaining unknown).
3. **Agent mode**: **test-driven-development** when **`TDD suitable: yes`** (or the TDD slice of **`partial`**). Follow **Verification** when **`no`**.
4. Suggested order is T1 through T9. T5 and T6 have no technical dependency on T3 or T4, but a screen test must assert roles, names, and callbacks, not spacing that T7 will change.
5. Equivalent internal changes: record and continue. A subtask split or merge updates ids, **Consumes** / **Produces**, partitioned **Acceptance**, and **Blocked by**, then logs a changelog row. Material changes: pause and confirm.

## Subtasks

Dependency notation: `Blocked by: T1` means start after T1 is done.

### T1 — Review findings

- [x] **Do:** Review the current tree against spec §3 and append the findings to `docs/implementation-issues.md`. Do not change production code.
- **Consumes:** none
- **Produces:** Entries tagged **bug** or **deferred**. Each bug names the file, the expected behaviour, and the observed behaviour. Duplicate `server/` and `src/server/` modules are noted as closed by T2, not as bugs. `gemini-unavailable`, combined `quota`, and HTTP 403 reported as `auth` are noted as closed by T3, not as bugs. Style notes are omitted.
- **Acceptance:** The new section exists. A reader can tell which findings T4 must fix and which are only logged. If nothing qualifies as a bug, the section says so.
- **Blocked by:** —
- **Plan mode:** high
- **TDD suitable:** no
- **TDD suitable reason:** A checklist review and a written log. No product behaviour changes.
- **Verification:** Read the new section against the spec §3 checklist. `git diff --stat` shows only `docs/implementation-issues.md`.

### T2 — Move the remaining server modules

- [x] **Do:** Move `server/{model,pipeline,pdf,intake}.ts` and their tests under `src/server/`, point `src/server/http/*` at the new paths, and delete `server/`.
- **Consumes:** none from T1. T1 is ordered first only so the review describes the pre-move tree.
- **Produces:** Those modules importable from `src/server/model.ts`, `src/server/pipeline.ts`, `src/server/pdf.ts`, and `src/server/intake.ts`. No source file imports `server/`. Vitest no longer includes `server/**/*.test.ts`.
- **Acceptance:** `src/server/model.test.ts` contains both the logging cases and the former `server/model.test.ts` cases, without two tests that assert the same expectation. `src/server/pipeline.test.ts` likewise contains the deadline and text-budget cases plus the former `server/pipeline*.test.ts` cases. PDF and intake tests sit beside their modules. Existing assertions stay green with updated imports and nothing else. Import suffixes are preserved per file.
- **Compatibility:** Recorded extraction, the 110-second deadline, the 100,000-character text budget, public-demo rejection, abort on `request.signal`, and metadata-only deployed logs.
- **Blocked by:** T1
- **Plan mode:** medium
- **TDD suitable:** no
- **TDD suitable reason:** Stay-green refactor. The suites already cover the moved behaviour. The named unknown is which tests in `server/*.test.ts` duplicate `src/server/{model,pipeline}.test.ts`.
- **Verification:** `npx vitest run src/server src/server/http`; `rg "from ['\\\"].*server/(model|pipeline|pdf|intake)" src` finds no `../../../server/` import.

### T3 — Classify live model failures

- [x] **Do:** One classifier produces the spec §4 codes and messages. Extraction recovery, the rate-limit wait, and interview copy follow that code. HTTP 200 error bodies do not trigger a repair call.
- **Consumes:** The moved `ModelError`, `createDefaultTransport`, `requestStructuredJson`, `mapModelError`, and `mapExtractionStreamError`.
- **Produces:** `classifyModelFailure(input: { status?: number; errorType?: string; retryAfterHeader?: string; network?: boolean })` returns `{ code: ModelFailureCode; message: string; retryAfterSeconds?: number }`. `errorType` wins over `status`. `retryAfterSeconds` is set only for `rate-limited`, from a finite positive header, and is never above 120. `ModelError` carries `retryAfterSeconds?`. `errorRecoveryAction` returns `retry`, `use-recorded`, or `back-to-intake` per spec §4.4, and any other code returns `back-to-intake`. `ApiError` and both the JSON envelope and the SSE `error` event carry `retryAfterSeconds?`. `INTERPRET_ONE_FIELD_SENTENCE` is `You can still answer with only this field's value.`
- **Acceptance:**
  - Each spec §4.1 row maps to its code and message, including `context_length_exceeded` on HTTP 400 becoming `text-too-large`, HTTP 403 becoming `model-blocked`, and HTTP 402 becoming `out-of-credits`.
  - A 200 body with an `error` object and empty assistant content throws that classified error. The transport mock for the repair prompt is not called. Non-empty assistant content is returned and parsed; invalid JSON still gets one repair call.
  - `mapModelError` uses the spec §4.1 HTTP statuses. `missing-key` stays 400 with `envVar: "OPENROUTER_API_KEY"` and the current message.
  - Interpret `malformed` stays `rephrase` and the current rephrase sentence. Any other interpret code shows `error.message` plus `INTERPRET_ONE_FIELD_SENTENCE`, does not say "Please rephrase.", and does not change phase or call interpret again.
  - Extraction shows Retry only for `rate-limited`, `model-unavailable`, `malformed`, `extraction-timeout`, and `internal-error`. `rate-limited` disables Retry until the wait elapses and does not submit by itself. `use-recorded` shows **Use recorded extraction** and calls the existing bundled-recorded action. `missing-key` has no Retry button and still explains `.env.local`. Every other code, including `text-too-large` and `live-unavailable`, shows **Back to intake**.
  - The UI no longer receives `gemini-unavailable`, `quota`, `upstream`, or `network`.
- **Compatibility:** Pipeline `TextTooLargeError` keeps its current message and stays an SSE `error` event. `ExtractionTimeoutError` stays `extraction-timeout`. Public demo responses stay `live-unavailable`. Restart session still clears the session and returns to intake.
- **Blocked by:** T2
- **Plan mode:** high
- **TDD suitable:** yes
- **Verification:** `npx vitest run src/server/model.test.ts src/server/model-failure.test.ts src/server/http/map-model-error.test.ts src/server/http/createInterpretHandler.test.ts src/screens/extraction-errors.test.ts src/screens/ExtractionProgress.test.tsx src/screens/InterviewWorkspace.test.tsx src/api.test.ts`

### T4 — Fix review bugs

- [x] **Do:** Fix every T1 finding tagged **bug**, one failing test at a time, against the moved tree. Do not fix deferred findings.
- **Consumes:** The T1 bug list. T3's codes, so a finding that was only the old error mapping is already resolved and is not fixed again.
- **Produces:** Each bug's regression test, and a note on that T1 entry naming the test. Deferred entries stay in `docs/implementation-issues.md` with no production change.
- **Acceptance:** Every bug entry is either fixed with a test that failed before the fix, or marked resolved by T2 or T3 with the reason. Deferred entries are unchanged in behaviour. An empty bug list makes this subtask done with no code change.
- **Compatibility:** Spec §11 is the only intended behaviour change beyond those bug fixes.
- **Blocked by:** T1, T3
- **Plan mode:** high
- **TDD suitable:** yes
- **Verification:** `npx vitest run` for each bug's test file, then `npm test`.

### T5 — Tests for screens that have none

- [x] **Do:** Add the five component tests named in spec §6. Assert behaviour, not layout.
- **Consumes:** `BudgetPause`, `SourceDrawer`, `ModeBadge`, `AppChrome`, and `AppShell` as they exist today. `AppShell` needs the session provider.
- **Produces:** Tests that fail if continue/finish, drawer content and close, the two mode labels, the post-intake restart button, the storage-warning text, or the active phase screen is removed.
- **Acceptance:** `BudgetPause` calls `onContinue` and `onFinish`. `SourceDrawer` shows the passage it was given and calls close. `ModeBadge` shows a distinct label for `recorded` and `live`. `AppChrome` omits Restart when not post-intake, shows it when post-intake, and shows `SESSION_PERSISTENCE_WARNING` when asked. `AppShell` renders the intake screen at the initial phase. No assertion depends on pixel spacing.
- **Blocked by:** —
- **Plan mode:** skip
- **TDD suitable:** yes
- **Verification:** `npx vitest run src/screens/BudgetPause.test.tsx src/screens/SourceDrawer.test.tsx src/components/ModeBadge.test.tsx src/components/AppChrome.test.tsx src/components/AppShell.test.tsx`

### T6 — Live extract path with a fake model

- [x] **Do:** Run the real extract handler and the real pipeline with a fake transport that returns one valid extraction JSON. Assert the SSE `result` dossier came from that JSON.
- **Consumes:** `createExtractHandler` and `runExtraction` after the move.
- **Produces:** `src/server/http/createExtractHandler.live-path.test.ts`
- **Acceptance:** The test performs no network call and adds no test-only route or production branch. The fake transport is the existing `HttpDeps.transport` slot. A transport that throws is not this test. Recorded mode is not this test.
- **Compatibility:** The handler's public-demo and upload checks stay in their existing tests.
- **Blocked by:** T2
- **Plan mode:** medium
- **TDD suitable:** yes
- **TDD suitable reason:** The named unknown is the smallest upload fixture that survives PDF/TXT parsing and quote verification so the fake JSON becomes a dossier. Resolve that in Plan mode only if a first reading of `runExtraction` does not make the fixture obvious.
- **Verification:** `npx vitest run src/server/http/createExtractHandler.live-path.test.ts`

### T7 — Prototype pass and overlay keyboard behaviour

- [x] **Do:** Match the spec §7 screens to the prototype at 1280px and 800px, and make the three interview overlays keyboard-usable.
- **Consumes:** The current screens and `prototype/DESIGN.md`. The six core tokens already in `src/app/globals.css` stay verbatim unless a comparison shows drift.
- **Produces:** Updated layout and copy only where the app disagrees with the prototype. Screenshots at `docs/design/quality-baseline/{screen}-{width}-{before|after}.png` for each spec §7 screen, `width` being `1280` or `800`. Overlay behaviour: Tab stays inside the open dialog; Escape closes the source drawer; Escape discards proposals; Escape does not close the budget pause; closing the drawer or proposals returns focus to the opener; the focused control has a visible ring.
- **Acceptance:** A side-by-side look at the screenshots shows the prototype's spacing, type, and layout, while every status, marker, and blocker remains visible. The public demo still hides live extraction and upload. Keyboard behaviour is covered by tests, not by the screenshots. No new screen or component.
- **Compatibility:** Dossier meanings, readiness verdicts, and the recovery buttons from T3.
- **Blocked by:** T3, T5
- **Plan mode:** high
- **TDD suitable:** partial
- **TDD suitable reason:** Test-first for focus trap, Escape, and focus return. The visual comparison is a screenshot check, not a unit test.
- **Verification:** `npx vitest run src/screens/SourceDrawer.test.tsx src/screens/ProposalConfirmation.test.tsx src/screens/BudgetPause.test.tsx`; screenshots present for both widths; `npm run dev` checked against the prototype for one drifted screen if any drift was found.

### T8 — Playwright paths

- [x] **Do:** Extend the public-demo Playwright suite with a keyboard-only recorded path, interview/report history, and restart.
- **Consumes:** The recorded kettle flow and the T7 keyboard behaviour. The app must already be servable with `npm run dev` as the public demo.
- **Produces:** Three additional tests in `e2e/recorded-kettle.spec.ts`, or a sibling spec file if the current file would mix unrelated setup.
- **Acceptance:** Keyboard only, using Tab, Enter, and type, with no pointer, reaches the report from intake. No request hits OpenRouter. Back from the report shows the interview, Forward shows the report, and an applied answer is still visible. Restart session shows intake, and a reload still shows intake. The existing click smoke still passes.
- **Blocked by:** T7
- **Plan mode:** medium
- **TDD suitable:** yes
- **TDD suitable reason:** The named unknown is which key sequence reaches the conflict, missing, and unverified answers without a pointer. Confirm it from the rendered controls in Plan mode only if the first Playwright attempt cannot see those controls.
- **Verification:** `npm run test:e2e`

### T9 — Limitations document

- [ ] **Do:** Add `docs/limitations.md` from spec §8 and point `README.md` at it.
- **Consumes:** T1 deferred entries, T3's resolved error behaviour, T4's fixed or empty bug list, and T7's completed screen list.
- **Produces:** One bullet per spec §8 row, marked **Open** or **Resolved**, with the owning sub-project. The "minor bugs" bullet stays **Open** and names the deferred entries when any exist. It is **Resolved** only when T1 recorded no bugs and no deferred findings.
- **Acceptance:** `PROPOSAL.md` has no diff. README still links `PROPOSAL.md` as the historical proposal, no longer says assessors must follow it literally, and links `docs/limitations.md`.
- **Blocked by:** T1, T4, T7
- **Plan mode:** skip
- **TDD suitable:** no
- **TDD suitable reason:** Documentation only.
- **Verification:** Read `docs/limitations.md` against spec §8 and the T1 section. `npm test`, `npm run test:e2e`, `npm run typecheck`, and `npm run build` pass.

## TDD note (Agent mode)

Per subtask, obey **`TDD suitable`**. **`yes`** means strict test-driven development. **`partial`** applies it only to the named behaviour. **`no`** means satisfy **Verification** without a new red test. T2 is a stay-green move. T4 is one red test per bug, and an empty bug list needs no test.

## Plan changelog

| Date | Change | Kind |
|------|--------|------|
| 2026-10-10 | Initial plan from the quality-baseline spec | — |
