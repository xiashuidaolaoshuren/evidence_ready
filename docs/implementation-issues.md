# Implementation Issues

A learning log of bugs and surprises found while building EvidenceReady. Each entry records what went wrong, why, and what we changed so the lesson sticks.

Entries 1–3 came from the third backend code-review pass (after T7 and two rounds of review-driven fixes). They were reproduced against the live module, not inferred from the spec. Later entries are live-path incidents captured for `PROPOSAL.md` (spec §15: any real AI failure discussed there must come from actual development experience, not a staged model mistake).

---

## 1. Unmatched adjudication silently confirms candidate 0

**When:** Third backend code review (conflict apply path)  
**Area:** `src/domain/apply.ts` (`applyAdjudicate`)  
**Symptom:** Adjudicating a value that is not one of the conflict candidates still confirmed the field, with an `adjudicated` marker, as if the user had chosen the first candidate.

### What we saw

1. Start with a three-way capacity conflict: `["1.5 L", "1.7 L", "2 L"]`.
2. Apply `{ type: "adjudicate", fieldKey: "capacity", selectedValue: "9 L" }`.
3. Field comes back `confirmed` with value `"1.5 L"` and marker `adjudicated`.
4. The user's actual selection is discarded. The audit trail claims they picked a value they never chose.

An invalid `fieldKey` already no-oped safely. An unmatched `selectedValue` did not.

### Root cause

`applyAdjudicate` treated a missing match as “pick the first candidate”:

```ts
const selectedIndex = normalizedValues.findIndex((value) =>
  normalizedEquals(value, selectedNormalized),
);
const winnerIndex = selectedIndex >= 0 ? selectedIndex : 0;
const loserIndex = winnerIndex === 0 ? 1 : 0;
```

`findIndex` returning `-1` became `winnerIndex = 0`. The field then wrote `confirmed` + `adjudicated` using candidate zero.

The existing test (`apply.test.ts`) only covered a valid two-candidate match, so the fallback never ran.

### Fix

Match against structured `conflictCandidates`. If nothing matches, return the field unchanged — same contract as an unknown field key:

```ts
const winner = field.conflictCandidates.find((candidate) =>
  normalizedEquals(candidate.normalizedValue, selectedNormalized),
);
if (!winner) return field;
```

Regression: `leaves a conflicting field unchanged when the selected value is not a candidate` — adjudicate `"9 L"` against `["1.5 L", "1.7 L"]`, assert status stays `conflicting` and no `adjudicated` marker.

### Lesson

- A fallback index (`>= 0 ? i : 0`) is not a safe default when the missing case is a user error. Prefer **no-op** over guessing a winner.
- Tests that only exercise the happy match hide the `-1` branch. Add the unmatched-selection case whenever a lookup drives a status change.
- Keep related failure modes consistent: unknown field and unknown selected value should both leave the dossier alone.

---

## 2. Three-way conflicts drop losing candidates

**When:** Third backend code review (conflict model)  
**Area:** `src/domain/apply.ts`, `src/domain/types.ts`, `src/domain/reconcile.ts`  
**Symptom:** After a user answered a conflict a second time (now a routine three-candidate list), adjudicating a winner retained only one loser as a string on `resolutionHistory`. Other losing values, citations, and evidence disappeared.

### What we saw

1. Conflict `["1.5 L", "1.7 L", "2 L"]`.
2. Adjudicate `"2.0 L"` (normalizes to `"2 L"`).
3. Field becomes `confirmed` with value `"2 L"`.
4. History records only `adjudicated:1.5 L`. The value `1.7 L` is gone — no citation, no candidate record.

Even in the two-candidate case, the loser survived only as `resolutionHistory[].detail` (a string), with its citation dropped.

This contradicts the spec (`docs/superpowers/specs/2026-08-28-evidence-ready-design.md` §5.4 / §8.5), `CONTEXT.md` (“the losing evidence is retained”), and ADR 0004.

### Root cause

Conflicts were modeled as parallel arrays stuffed into `originalValue` / `normalizedValue`, plus a shared field-level `evidence[]`. Adjudication assumed exactly two candidates:

```ts
const loserIndex = winnerIndex === 0 ? 1 : 0;
```

Commit `969222a` made three-or-more candidates the normal case: answering a `conflicting` field now *appends* a distinct value instead of auto-resolving to `user-provided`. The two-slot loser index did not grow with that change.

`Conflict` / `ConflictCandidate` already existed in `types.ts` (and were re-exported) with the right shape — per-candidate value, citation, and `source: "document" | "user"` — but had **zero runtime consumers**. Reconciliation and apply never used them.

### Fix

Add two arrays on `DossierField`:

- `conflictCandidates` — source of truth while `status === "conflicting"`
- `adjudicatedLosers` — every non-winner after adjudication, with source and citation

Keep `originalValue` / `normalizedValue` as the current compatibility view (arrays while unresolved, scalar winner after).

`applyAdjudicate` now:

1. Finds the winner by normalized value.
2. Writes all other candidates to `adjudicatedLosers`.
3. Sets winner evidence from that candidate only (document citation, or `[]` for a user-sourced winner).
4. Clears `conflictCandidates`.

Reconciliation emits `conflictCandidates` for scalar document-vs-document conflicts. `provide-answer` on a confirmed field seeds a document candidate plus a user candidate.

Regression: `retains every non-winner with provenance when adjudicating a three-way conflict`.

### Lesson

- Parallel arrays plus a two-index loser formula **cannot** represent n-way conflicts. When you change “append another candidate” behavior, audit every consumer that assumed `length === 2`.
- Types that match the spec but are unused (`ConflictCandidate`) are a smell: either adopt them or delete them. Dead types hid that the runtime model was still the array hack.
- A traceability product that deletes losing evidence is arguing against itself — store losers as structured candidates, not as a history string.

---

## 3. Unhandled errors return plain-text 500 (broken JSON error envelope)

**When:** Third backend code review (HTTP boundary)  
**Area:** `server/http.ts`, `src/domain/schemas.ts`  
**Symptom:** Failures outside the explicit catch branches returned Hono’s default **500** with `Content-Type: text/plain` and body `Internal Server Error`. The frontend contract is `{ error: { code, message } }`.

### What we saw

```
POST /api/interpret  {"fieldKey":"capacity","answerText":"x","dossier":[null]}
→ 500, body: Internal Server Error
```

A non-object element like `["nope"]` was worse in a quieter way: it passed validation, and `undefined: undefined` was interpolated into the Gemini prompt.

The same envelope gap applied to missing fixture files (`ENOENT` from `readFileSync`) and other unexpected throws.

A related misclassification: corrupt `recorded-extraction.json` threw `SyntaxError` from `JSON.parse` inside the pipeline, and the extract handler treated **all** `SyntaxError` as client `400 invalid-request`.

### Root cause

Two holes stacked:

**1. `z.custom` is not validation.** Interpret used:

```ts
dossier: z.array(z.custom<DossierField>()),
```

`z.custom()` with no predicate accepts `null`, strings, anything. `dossierSummary` then did `field.key` / `field.status` and threw `TypeError`, which was not in the catch list.

**2. No `app.onError`.** Route handlers ended with `throw error`. Hono’s default handler emits plain text. The backend plan required “JSON errors the UI can render.”

`SyntaxError` from `c.req.json()` (client body) and `JSON.parse` of a bundled fixture (server data) are the same JavaScript type, so one catch mapped both to 400.

Existing HTTP tests covered malformed JSON bodies and Gemini errors, not `dossier: [null]`, unexpected throws, or fixture ENOENT.

### Fix

- Export a real `dossierFieldSchema` / `dossierSchema` and wire it into `interpretRequestSchema`. Null and non-object members become **400** `{ error: { code: "invalid-request" } }` before prompt construction.
- Register `app.onError` returning **500** `{ error: { code: "internal-error", message: "Unexpected server error." } }` with no path or stack leak.
- Scope `SyntaxError` to `c.req.json()` only. Fixture parse/ENOENT fall through to `onError` as server faults.

Regressions in `server/http.test.ts`: malformed dossier members; unexpected extraction throw; corrupt recorded JSON; missing fixture directory.

### Lesson

- **Zod at the HTTP boundary means a real schema**, not `z.custom<T>()` for TypeScript-only typing. The type parameter is erased at runtime.
- Catch lists are incomplete by construction — a catch-all `onError` (or equivalent) is what keeps the error *envelope* invariant when a new throw appears.
- Do not key HTTP status off a shared language type (`SyntaxError`, `ZodError`) when the same type can come from the client *or* from server-side files. Catch at the call site that produced the error.
- The UI will parse `error.code`. A plain-text 500 is a contract break, not a generic server failure.

---

## 4. Live Gemini “unavailable” was a retired model — then a geo block

**When:** Live-extraction smoke after the frontend interview path was in place (31 Aug 2026)  
**Area:** `server/gemini.ts` (`createDefaultTransport`, `mapTransportError`), `server/http.ts` (`mapGeminiError`)  
**Symptom:** With `GEMINI_KEY` set in `.env.local`, live bundled extract showed **Extraction could not complete** / **Gemini service is temporarily unavailable.** / **Retry**. Recorded extract still worked.

This is the kind of incident spec §15 wants in `PROPOSAL.md`: a real integration failure from development, not a staged hallucination.

### What we saw

The missing-key card is a different heading (“Live extraction needs a Gemini API key”). That card did **not** appear, so the server had already passed `requireApiKey`.

The copy **“Gemini service is temporarily unavailable.”** is produced only when `GeminiError.code === "upstream"`:

```ts
if (error.code === "upstream") {
  return jsonError(
    "gemini-unavailable",
    "Gemini service is temporarily unavailable.",
    {},
    503,
  );
}
```

`mapTransportError` maps 401/403 → `auth`, 429 → `quota`, `TypeError` → `network`, and **everything else** (including HTTP 400/404) to `upstream`. Two distinct API failures therefore collapsed to the same 503 and the same Retry button.

**Layer A — retired model.** `createDefaultTransport` hardcoded `gemini-2.0-flash`. Google shut that id down on **1 June 2026** (documented replacement: `gemini-3.7-flash`). A 404-shaped SDK error is not 401/429, so it became `upstream`. Configuring the key could not help: every live `generateContent` called a dead model.

**Layer B — region after the swap.** After switching to `gemini-3.7-flash`, a direct SDK probe with the same key returned:

```text
ApiError: {"error":{"code":400,"message":"User location is not supported for the API use.","status":"FAILED_PRECONDITION"}}
status: 400
```

That 400 is also unmapped, so the UI still said “temporarily unavailable.” The model-id fix was real; the remaining failure is **Gemini Developer API geo policy**, not a missing key and not a transient outage.

### Root cause

Three decisions stacked:

1. A **hardcoded model id** with no pin, alias, or deprecation check. Live extract is only as current as that string.
2. **Coarse error mapping.** Auth/quota/network are typed; 404 (unknown model) and 400 `FAILED_PRECONDITION` (unsupported location) fall through to `upstream` → user copy that implies a brief outage.
3. **Live path is optional for the demo, but the failure looks like the product is broken.** Recorded replay exists so the interview does not depend on Gemini being reachable from this network. The undifferentiated 503 hid that distinction.

### Fix

- Export `GEMINI_MODEL = "gemini-3.7-flash"` and use it in `createDefaultTransport`. Keep `responseMimeType: "application/json"`.
- Do **not** invent a new error code or log document text in that pass. Geo restriction remains `gemini-unavailable` until a later mapping change.
- Recorded mode is the assessable path when live Gemini cannot run (unsupported region, quota, retired id).

### Lesson (proposal-ready)

- **A configured key is not a working live path.** The first diagnosis (“the key is set, so Gemini must be down”) was wrong twice: first a retired model, then a region block. Same screenshot, different causes.
- **Vendor model ids rot.** Pinning `gemini-2.0-flash` was correct in 2025 and false in August 2026. Recorded extraction is not a test shortcut; it is how the demo stays honest when the live vendor surface moves.
- **Collapse distinct faults into “temporarily unavailable” and you cannot debug from the UI.** Assessors and operators will retry a geo 400 forever. Typed codes (`auth`, `quota`, `network`, and a location/precondition class) earn their keep at the HTTP boundary.
- **Do not stage a model mistake for the proposal.** Unsupported-citation rejection is in the recorded fixture on purpose. This incident is the live-AI failure to cite: integration and availability, not the model inventing a field.

### Lift into `PROPOSAL.md` (when writing it)

Suggested use: limitations / AI-assisted workflow, one short anecdote.

- Problem: live extract failed with a generic 503 despite a valid `GEMINI_KEY`.
- Cause 1: hardcoded `gemini-2.0-flash` after Google’s 1 June 2026 shutdown.
- Cause 2 (same UI): `400 FAILED_PRECONDITION` “User location is not supported for the API use.”
- Response: swap to `gemini-3.7-flash`; keep recorded replay as the deterministic demo; treat live Gemini as best-effort from a supported region.
- **Update (Sep 2026):** Live extract now routes through OpenRouter (`google/gemini-3.7-flash`) with `OPENROUTER_API_KEY` in `.env.local`, bypassing the Google Developer API geo block without changing the control plane.
- **Update (Sep 2026, later):** OpenRouter returned `403` provider ToS for Gemini (and other providers) on a restricted account. Live model switched to `deepseek/deepseek-v4-flash-vision-exp` with text-only prompts; unpdf page text and quote verification unchanged.
- What we would do next: map location/precondition (and unknown-model 404) to distinct codes and copy, instead of `gemini-unavailable`.

---

## 5. Quality baseline review (spec §3)

Reviewed on 2026-10-11 against today's tree, before the server move and the error-code change.

### Bugs for T4

No findings qualify as bugs. T4 has nothing to fix from this review.

**T4 closure (2026-10-12):** Re-checked after T2 and T3 on the current tree. The bug list is still empty; no production or test changes were required. Items tagged closed-by-T2 were resolved by commits `995d0cc` and `07f5af1` (modules and tests under `src/server/`, no `server/` imports). Items tagged closed-by-T3 were resolved by commit `d7b94ad` (spec §4 classifier and recovery; legacy `gemini-unavailable`, `quota`, `upstream`, and `network` are not emitted to the UI). The two deferred entries above are unchanged.

Glossary copy, the ADR 0002–0006 consequences that still hold, and the non-stream error envelope were checked and did not produce a bug. Ordinary English ("at least one file is required"), the footer denial ("not a legal-compliance conclusion"), and the health route's plain `ok` success body were not filed. Superseded ADR sentences (the Vite stack, and "every adjudication stays confirmed") were not filed.

### Deferred

#### Missing `server-only` import on the top-level server modules

- **Tag:** deferred
- **Checklist:** Server modules import `server-only`. No client module can reach the API key.
- **File:** `server/model.ts`, `server/pipeline.ts`, `server/pdf.ts`, `server/intake.ts`
- **Expected:** Server modules import `server-only`, and no client module can read the API key.
- **Observed:** Those four modules do not import `server-only`. Every runtime module under `src/server/http/` does. No `"use client"` module imports `server/`. `OPENROUTER_API_KEY` is read only in `src/app/api/extract/route.ts`, `src/app/api/interpret/route.ts`, and `server/model.ts`. `src/screens/ExtractionProgress.tsx` shows the variable name, not the secret. Nothing in a client module reads the key, so this is not a key leak.
- **Why deferred:** Adding the import does not change what a user can do today. T2 moves these files and must not add behaviour.

#### Private live extraction is not wired through the extract handler

- **Tag:** deferred
- **Checklist:** ADR 0005, while checking that the public demo never calls the model. The migration spec also says a private deployment keeps live extraction working.
- **File:** `src/server/http/createExtractHandler.ts`
- **Expected:** On a private deployment, live extraction of the bundled example and multipart upload run the pipeline. The public demo never calls the model.
- **Observed:** The public demo returns `live-unavailable` and does not call the model. A non-demo JSON body with `mode: "live"`, and any multipart upload, return HTTP 400 `invalid-intake` and never call `runExtraction`. Private answer interpretation does call the model.
- **Why deferred:** Wiring that path would add the private live-extract and upload behaviour. It is not a T4 bug. The public-demo gate holds.

### Closed by a later subtask

These were checked. They are not bugs, and T4 does not fix them.

#### Closed by T2 — the `server/` split

- **Tag:** closed-by-T2
- **Checklist:** Modules and tests that exist twice, once under `server/` and once under `src/server/`.
- **File:** `server/model.ts`, `server/pipeline.ts`, `server/pdf.ts`, `server/intake.ts`, and their tests; `src/server/http/*`
- **Observed:** The four implementations exist only under `server/`. `src/server/http/*` imports them via `../../../server/...`. Tests exist in both trees: `server/model.test.ts` with `src/server/model.test.ts`, and `server/pipeline.recorded.test.ts`, `server/pipeline.live.test.ts`, `server/pipeline.partial.test.ts`, `server/pipeline.progress.test.ts`, and `server/pipeline.insufficient.test.ts` with `src/server/pipeline.test.ts`. PDF and intake tests exist only under `server/` (`server/pdf.test.ts`, `server/pdf.encrypted.test.ts`, `server/pdf.errors.test.ts`, `server/intake.test.ts`).

#### Closed by T3 — known-wrong model codes

No separate dead export exists only to preserve these codes. The live mappings and the tests below are the lock.

- **Tag:** closed-by-T3
- **Checklist:** Dead exports and tests that lock `gemini-unavailable`, `quota` for both 402 and 429, and HTTP 403 as `auth`.
- **File:** `server/model.ts`
- **Observed:** `mapTransportError` maps HTTP 401 and HTTP 403 to `auth`, and both HTTP 402 and HTTP 429 to `quota`. Other failures become `upstream` or `network`.

- **Tag:** closed-by-T3
- **Checklist:** Tests that lock those codes.
- **File:** `server/model.test.ts`
- **Observed:** "maps OpenRouter 402 payment required to quota" expects `quota`. "maps quota, auth, and network failures to typed errors" expects HTTP 429 as `quota` and HTTP 401 as `auth`. HTTP 403 uses the same `auth` branch as 401.

- **Tag:** closed-by-T3
- **Checklist:** Tests and mappings that lock `gemini-unavailable`.
- **File:** `src/server/http/map-model-error.ts`, `src/server/http/map-stream-error.ts`, `src/server/http/createInterpretHandler.test.ts`
- **Observed:** An `upstream` model error is emitted as `gemini-unavailable`. The interpret test "returns gemini-unavailable JSON for upstream model faults" locks that code.

- **Tag:** closed-by-T3
- **Checklist:** Recovery actions for the known-wrong codes.
- **File:** `src/screens/extraction-errors.ts`
- **Observed:** `errorRecoveryAction` treats `network`, `quota`, `auth`, and `gemini-unavailable` as retry. Any code outside the missing-key and file-error sets, including an unknown code, also returns retry.

---
