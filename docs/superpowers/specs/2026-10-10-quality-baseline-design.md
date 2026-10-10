# Quality Baseline Design

**Date:** 2026-10-10
**Status:** Draft for review
**Sub-project:** 2 of 7. The model harness, field semantics, multi-category blueprints, richer inputs, and persistence stay out of scope. Sub-project 1 (Next.js migration) is done.

EvidenceReady's assessment proposal lists limitations that are now the personal project's backlog. This sub-project closes three of them: live model failures that share one message and the wrong recovery action, behaviour that has no test, and screens that have drifted from the prototype. It also finishes the server move the migration left half-done. Domain vocabulary stays in [`CONTEXT.md`](../../../CONTEXT.md). `PROPOSAL.md` stays the historical assessment record.

## 1. Decisions

| Decision | Choice |
| --- | --- |
| Live model failures | One app code per failure class, taken from OpenRouter `error.metadata.error_type` when present, otherwise from the HTTP status |
| Recovery | A closed table. Retry only for failures that can succeed if repeated. No automatic second request |
| Unknown code | Back to intake. A code missing from the table never offers Retry |
| Interview failures | Stay on the question. Copy names the cause. Only `rephrase` asks the user to rephrase |
| Tests | A named list of behaviours. No coverage percentage gate |
| Review | One pass over the repo. Fix incorrect behaviour here. Log anything larger |
| UI | Side-by-side with `prototype/` and `prototype/DESIGN.md`, at desktop width and below 980px |
| Limitations record | New `docs/limitations.md`. `PROPOSAL.md` is not edited |
| Server layout | `server/` is deleted. Pipeline, model, PDF, and intake live under `src/server/` |

## 2. Goals and non-goals

### 2.1 Goals

- A bad key, an unknown model, a provider block, a rate limit, an empty credit balance, and a region-style rejection each produce their own code, message, and recovery action.
- An OpenRouter error delivered inside HTTP 200 is classified the same way. It does not trigger the JSON repair call.
- Every code in section 4 has a test for its recovery action.
- The screens named in section 7 match the prototype's tokens, spacing, type, and layout, and the three interview overlays are keyboard-usable.
- `server/` no longer exists, and `src/server/http` no longer imports `../../../server/...`.
- `docs/limitations.md` states which limitations this sub-project closed and which remain open.

### 2.2 Non-goals

- A model harness, pinned fixtures, or accuracy metrics.
- Semantic quote checks, a "not applicable" status, or prose conflicts.
- A second product category, OCR, images, spreadsheets, or cross-device persistence.
- Accounts or multi-user review.
- A coverage threshold in CI.
- Pixel snapshot tests.
- Restyling anything the prototype does not show.
- Editing `PROPOSAL.md`.

## 3. Code review

The review happens before the server move and the error-code change, so findings are about today's code.

The checklist is:

- UI copy uses the terms in `CONTEXT.md`.
- The consequences of ADRs 0002–0006 still hold in the code that claims to implement them.
- Every non-stream HTTP error is the JSON envelope `{ error: { code, message, ... } }`, with no stack and no filesystem path.
- Server modules import `server-only`. No client module can reach the API key.
- Nothing in the client bundle reads `OPENROUTER_API_KEY`.
- Modules and tests that exist twice, once under `server/` and once under `src/server/`, are listed.
- Dead exports and tests that lock in a known-wrong code (`gemini-unavailable`, `quota` for both 402 and 429, HTTP 403 as `auth`) are listed.

A finding is a **bug** when the code does something other than what the spec, ADR, or glossary says. Bugs are fixed in this sub-project. Each fix starts from a failing test, then the production change. A module that exists in both `server/` and `src/server/` is not a separate bug. Section 5 removes that split.

A finding is **deferred** when fixing it would add a feature, change a dossier rule, or restructure a module beyond the server move in section 5. Deferred findings are appended to `docs/implementation-issues.md` and are not fixed here.

Style preferences, rename-only suggestions, and "could be simpler" notes are not findings.

## 4. Live model errors

OpenRouter's chat completions API returns `error.metadata.error_type` on provider failures. That field is the classifier. The HTTP status is the fallback when `error_type` is absent. The classifier lives in one function used by extraction and interpretation. Message text is fixed in that function. The UI displays `error.message` and does not invent a second sentence for the same code.

### 4.1 Classification

| `error_type`, else HTTP status | App code | Message |
| --- | --- | --- |
| `rate_limit_exceeded`, else 429 | `rate-limited` | `The model is rate limiting requests. Wait, then retry.` |
| `payment_required`, else 402 | `out-of-credits` | `The OpenRouter account has no credits left. Recorded extraction still works.` |
| `authentication`, else 401 | `auth` | `The OpenRouter API key was rejected.` |
| no key configured | `missing-key` | The existing missing-key message, including `envVar: "OPENROUTER_API_KEY"` |
| `permission_denied`, `content_policy_violation`, `refusal`, else 403 | `model-blocked` | `The model provider blocked this request.` |
| `not_found`, else 404 | `model-not-found` | `The configured model is not available.` |
| `context_length_exceeded`, `string_too_long` | `text-too-large` | `These documents are too long for one extraction. Submit fewer or shorter documents.` |
| `provider_overloaded`, `provider_unavailable`, `timeout`, `server`, `unmapped`, else 408, 502, 503, 504, or any other 5xx | `model-unavailable` | `The extraction model is temporarily unavailable.` |
| a `TypeError` or a failed `fetch` with no status | `model-unavailable` | `The model could not be reached.` |
| `invalid_request`, `invalid_prompt`, `precondition_failed`, `unprocessable`, `max_tokens_exceeded`, `token_limit_exceeded`, `payload_too_large`, else any other 400 or 412 | `model-rejected` | `The model rejected this request. Retrying will not help.` |
| body is not JSON after the repair call | `malformed` | `The model returned an invalid response.` |

`error_type` wins over status. A 400 with `error_type: "context_length_exceeded"` is `text-too-large`, not `model-rejected`. A 403 is `model-blocked`, never `auth`. A 402 is `out-of-credits`, never a rate limit.

`gemini-unavailable`, `quota`, `upstream`, and `network` are removed as codes the UI can receive. Internal model errors use the app codes above.

HTTP status for the JSON envelope, before a stream starts:

| Codes | Status |
| --- | --- |
| `rate-limited` | 429 |
| `out-of-credits` | 402 |
| `auth`, `missing-key` | 401 for `auth`, 400 for `missing-key` (unchanged) |
| `model-blocked` | 403 |
| `model-not-found` | 404 |
| `model-rejected`, `malformed`, `text-too-large` when it comes from the model | 400 |
| `model-unavailable` | 503 |

`text-too-large` from this app's own extracted-text budget stays the code and message it has today, and stays a stream `error` event when the pipeline throws it. The model-side `context_length_exceeded` uses the same code and the same message.

### 4.2 Errors inside HTTP 200

If the response status is 200 and the JSON body has an `error` object and the assistant content is missing or empty, that object is classified with the table in 4.1. The transport throws that classified error. `requestStructuredJson` does not send a repair prompt for it.

If assistant content is non-empty, the transport returns that content and ignores a sibling `error` object. A repair call happens only when that content is not valid JSON.

### 4.3 Rate limit wait

`rate-limited` may include `retryAfterSeconds` on the JSON error object and on the SSE `error` event. The value comes from a finite, positive `Retry-After` header counted in seconds. The client does not send another model request by itself. On the extraction screen the Retry button is disabled until that many seconds have elapsed, and the message includes the wait. Values above 120 are stored as 120, so a bad header cannot lock the button for longer than the function limit. A missing or unparseable header leaves Retry enabled immediately. The interview shows the same wait in its message and does not call interpret again until the user submits.

### 4.4 Extraction recovery

`errorRecoveryAction` returns one of `retry`, `use-recorded`, or `back-to-intake`. The retry set is closed. Anything not listed here returns `back-to-intake`.

| Action | Codes | What the screen shows |
| --- | --- | --- |
| `retry` | `rate-limited`, `model-unavailable`, `malformed`, `extraction-timeout`, `internal-error` | The server message and a Retry button. `rate-limited` disables it as in 4.3 |
| `use-recorded` | `auth`, `missing-key`, `out-of-credits`, `model-not-found`, `model-rejected` | The server message and **Use recorded extraction**. That button starts the bundled recorded example, the same action as today's missing-key button. It does not replay the user's files. `missing-key` also keeps the current explanation of `.env.local`. No Retry button |
| `back-to-intake` | `model-blocked`, `text-too-large`, `live-unavailable`, `encrypted`, `image-only`, `empty`, `unsupported`, `corrupt`, `invalid-intake`, `payload-too-large`, `all-sources-failed`, and every code not listed | The server message and **Back to intake** |

The header **Restart session** control stays available on every failure. It is how someone returns to intake and starts a new live run after fixing a key or a model id. The in-screen `use-recorded` action does not clear that path.

### 4.5 Interview copy

An interpret failure does not change the phase and does not call interpret again by itself. The question form stays usable. `rephrase` keeps the current sentence, `Could not interpret the answer. Please rephrase.` Every other code shows `error.message` plus one fixed sentence: `You can still answer with only this field's value.` Empty answers still declare the field unavailable, and a direct value is still applied without a model call, as they are today.

## 5. Finish the server move

These files still live in the top-level `server/` directory, and `src/server/http/*` imports them through `../../../server/...`:

- `pipeline.ts`, `model.ts`, `pdf.ts`, `intake.ts`
- their tests, including `pipeline.recorded.test.ts`, `pipeline.live.test.ts`, `pipeline.partial.test.ts`, `pipeline.progress.test.ts`, `pipeline.insufficient.test.ts`, `pdf.test.ts`, `pdf.encrypted.test.ts`, `pdf.errors.test.ts`, `intake.test.ts`, and `model.test.ts`

Move each module under `src/server/`. Move its tests next to it. Where `src/server/*.test.ts` and `server/*.test.ts` cover the same behaviour, keep one test file and drop the duplicate assertions. Update imports to the new paths. Delete `server/`. Remove `server/**/*.test.ts` from the Vitest `include` list.

This move is a refactor. Existing tests must stay green without new assertions. The import trial from the migration spec already settled the `.js` suffix question; follow whatever the tree does now, and do not reopen it.

## 6. Tests that are missing

These are the behaviours this sub-project adds tests for. A passing test that already exists is left alone.

- **Recovery table.** One test lists every code in section 4.4 and expects its action. A code that is not in the retry or use-recorded sets expects `back-to-intake`.
- **Classifier.** One test per row of section 4.1, including `error_type` winning over status, HTTP 403 becoming `model-blocked`, and HTTP 402 becoming `out-of-credits`.
- **HTTP 200 with an error object.** The repair transport is not called. The thrown code matches section 4.1.
- **Retry-After.** `retryAfterSeconds` is set from the header, capped at 120, and omitted when the header is absent. The extraction screen disables Retry until the wait elapses.
- **Interview.** `rephrase` shows the rephrase sentence. `out-of-credits` shows the credit sentence plus the one-field sentence, and does not show "Please rephrase."
- **Screens with no test file today.** `BudgetPause` (continue and finish), `SourceDrawer` (open content and close), `ModeBadge` (recorded and live labels), `AppChrome` (restart only after intake, storage warning text), `AppShell` (renders the active phase's screen).
- **Live path without a network call.** A test calls the real extract route factory with a fake model transport that returns one valid extraction JSON. The pipeline runs, and the stream ends with a `result` whose dossier came from that JSON. No test-only route and no branch that exists only for tests.
- **Playwright**, on the public demo, in addition to the current smoke:
  - keyboard only: from intake, reach the report using Tab, Enter, and Escape, with no pointer
  - Back from the report returns to the interview, Forward returns to the report, and an applied answer is still there
  - Restart session returns to intake and a reload shows intake

Bugs found in section 3 get their own failing test per bug. Those tests are not limited to this list.

## 7. Prototype pass

Compare the running app with `prototype/evidenceready-prototype-v2.html` and bind tokens from `prototype/DESIGN.md`. The prototype directory is gitignored, so the comparison record committed with this work is a screenshot of each screen below, before and after, at two widths: 1280px and 800px. Save them under `docs/design/quality-baseline/`.

Screens:

- intake
- extraction in progress, failed, and succeeded
- insufficient evidence
- interview: conflict question, missing question, unverified question
- interview overlays: source drawer, proposal confirmation, budget pause
- readiness report

Rules:

- The six core tokens in `DESIGN.md` are copied verbatim into the app stylesheet. Derived mixes are not given new values.
- Status colors stay the five provenance colors. The sienna accent stays on eyebrows and the primary action only.
- Spacing, type, and layout follow the prototype. Where the app and the prototype disagree, the prototype wins unless that would hide a status, a marker, or a blocker the product spec requires.
- Do not add screens, fields, or components the prototype does not have.

Keyboard behaviour, tested rather than judged from screenshots:

- Tab order reaches every control in the open overlay before the page behind it.
- Escape closes the source drawer. Escape on the proposal confirmation discards the proposals, which is the same as **Discard**.
- Escape does not close the budget pause. Continue and Finish are the only ways out of it. Closing it any other way would leave the interview with no question and no choice.
- Closing the drawer or the proposal confirmation returns focus to the control that opened it.
- The focused control has a visible ring.

The public demo's hidden live and upload controls stay hidden. The prototype shows them because it predates that demo. That difference is intended and is not "fixed" by showing those controls.

## 8. Limitations document

Create `docs/limitations.md`. It is the personal project's current list. Copy the bullets from `PROPOSAL.md` §6 except the time-budget bullet, and add the multi-user note already implied there.

Each bullet is marked **Open** or **Resolved**, with the sub-project that owns it:

| Bullet | After this sub-project |
| --- | --- |
| Quote verification is syntactic, not semantic | Open — sub-project 5, field semantics |
| No "not applicable"; prose fields never conflict | Open — sub-project 5 |
| Live extraction failures share one message and the wrong recovery | Resolved — this spec, section 4 |
| Kettle schema only, and no OCR, images, spreadsheets, or cross-device persistence | Open — sub-projects 4, 6, and 7 |
| Multi-user review | Open — not in the seven sub-projects. Needs accounts, which the migration excluded |
| Minor bugs may remain | Resolved only for bugs this sub-project fixed or proved absent. The bullet stays Open if section 3 defers anything, and it names those deferred entries |
| Model harness is weak | Open — sub-project 3 |
| UI may not be aligned | Resolved — section 7, for the screens listed there |

`README.md` links to `docs/limitations.md` and drops the sentence that says assessors must follow `PROPOSAL.md` literally. The link to `PROPOSAL.md` as the historical proposal stays.

## 9. Order

1. Code review, and write the findings down.
2. Move `server/` into `src/server/` and delete the old tree.
3. Replace the classifier, the recovery table, and the interview copy.
4. Fix each bug from step 1, one failing test at a time.
5. Add the tests in section 6 that step 4 did not already add.
6. Prototype pass, keyboard behaviour, and screenshots.
7. Write `docs/limitations.md` and the README link.

## 10. Done when

- `server/` is gone, and no source file imports it.
- The codes in section 4 are the codes the UI receives. `gemini-unavailable`, `quota`, `upstream`, and `network` are not among them.
- A 200 response whose body is an error does not call the model a second time.
- Retry is offered only for the codes in the retry row. Rate limit Retry waits, and never fires by itself.
- The interview shows the rephrase sentence only for `rephrase`.
- The section 6 tests and the Playwright paths pass.
- `docs/design/quality-baseline/` has the before and after screenshots.
- `docs/limitations.md` matches section 8.
- `npm test`, `npm run test:e2e`, `npm run typecheck`, and `npm run build` pass.

## 11. Explicit behaviour changes

Everything not in this list stays as it is.

| Today | After |
| --- | --- |
| HTTP 403 from the model is `auth` | `model-blocked`, and extraction goes back to intake |
| HTTP 402 and 429 are both `quota`, and Retry is offered | 402 is `out-of-credits` and offers recorded extraction. 429 is `rate-limited` and Retry waits for `Retry-After` |
| Unknown model and other non-auth failures are `gemini-unavailable` with Retry | `model-not-found` or `model-rejected`, and the screen offers recorded extraction |
| A provider error inside HTTP 200 becomes a repair call, then `malformed` | Classified from `error_type`, with no repair call |
| `text-too-large`, `extraction-timeout`, and `live-unavailable` fall through to Retry | `extraction-timeout` retries. The other two go back to intake |
| `missing-key` offers Retry and recorded extraction | Recorded extraction only, plus the existing key explanation. Restart session still returns to intake |
| Any interpret failure other than `rephrase` says "Please rephrase." | The server message, plus the one-field sentence |
| An unknown error code offers Retry | Back to intake |
| Pipeline, model, PDF, and intake live in `server/` | They live in `src/server/`, and `server/` is deleted |
| README says assessors must follow `PROPOSAL.md` literally | README points at `docs/limitations.md` for the current list |
