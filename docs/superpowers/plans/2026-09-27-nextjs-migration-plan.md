# Implementation plan: Next.js migration

**Spec:** [docs/superpowers/specs/2026-09-27-nextjs-migration-design.md](../specs/2026-09-27-nextjs-migration-design.md)
**Glossary:** [CONTEXT.md](../../../CONTEXT.md)
**Decisions:** [ADR 0005](../../adr/0005-nextjs-on-vercel.md), [ADR 0006](../../adr/0006-adjudication-keeps-evidence-status.md)
**Created:** 2026-09-27
**Subsystem scope:** Move the Vite + Hono app to one Next.js App Router process, and apply the review corrections that ship with that move.

## Summary

Ship EvidenceReady as one Next.js app on port 3000. The public deployment replays the bundled kettle extraction and keeps the interview and readiness report without a model call. The private deployment adds live extraction and answer interpretation behind Vercel Authentication on every URL. Domain behaviour stays as it is, except a user-supplied adjudication winner stays user-provided, and the report treats only essential conflicts as blocking.

Out of scope: OCR, a second product category, a model harness, accounts, a database, and changes to `PROPOSAL.md`.

## Discovery notes

- **Reuse:** Current reducer in `src/app-state.ts`, screens, `src/domain`, `server/http.ts` SSE and error envelope, `server/pipeline.ts`, and the recorded kettle fixtures. ADRs 0003 and 0004 stay in force, with the clarifications already written into them.
- **Constraints:** Node.js runtime route handlers, `dynamic = "force-dynamic"`, `maxDuration = 120`, extraction deadline 110 seconds. `EVIDENCEREADY_PUBLIC_DEMO=1` rejects live work with HTTP 403 `live-unavailable`. Upload cap is 3 files and 4 MiB total. Session version 2 lives in `localStorage` for seven days. Do not import server modules into client components; server modules use `server-only`.
- **Patterns to follow:** Factories take the same dependency slots as today's `HttpDeps`, plus the demo flag. Tests call the factory with fakes and `new Request(...)`. Zod stays at the HTTP and session boundaries. Phase-to-URL mapping has one module.
- **Anti-goals:** Do not mount Hono. Do not add application login. Do not split long documents across model calls. Do not log document text, answers, or model excerpts on Vercel. Do not rewrite screens beyond the demo, limit, warning, and report-wording changes.

## File map

### Subsystem: Next.js app

| Path | Create/Modify | Responsibility | Public surface |
|------|----------------|----------------|----------------|
| `package.json` | modify | Add Next.js, `server-only`, Tailwind PostCSS. Remove Hono, the Vite app plugin, and `dev:server`. Add `dev`, `build`, `start`. | npm scripts |
| `next.config.ts` | create | `outputFileTracingIncludes` for `fixtures/kettle`. | Next config |
| `tsconfig.json` | modify | Next plugin, `jsx: preserve`, drop `vite.config.ts` from `include`. | compiler options |
| `src/domain/apply.ts` | modify | Documented adjudication winner stays confirmed; user-supplied winner stays user-provided. | `applyEvent` |
| `src/domain/upload-limits.ts` | create | Shared count and 4 MiB total. | `MAX_UPLOAD_COUNT`, `MAX_TOTAL_UPLOAD_BYTES` |
| `src/domain/schemas.ts` | modify | Session and conflict citations keep optional `surroundingWindow`. | dossier schema |
| `src/screens/ReadinessReport.tsx` | modify | Essential conflicts block; supporting conflicts are visible and do not. | `ReadinessReport` |
| `src/screens/Intake.tsx` | modify | 4 MB total copy. Public demo hides live and upload. | `Intake` |
| `src/screens/InterviewWorkspace.tsx` | modify | Public demo shows one-field guidance and skips interpret. | `InterviewWorkspace` |
| `src/session.ts` | modify | Version 2, `updatedAt`, consistency, seven-day expiry, quota warning copy. Move to `src/state/session.ts` with the app shell. | `loadSession`, `saveSession`, `clearSession` |
| `src/state/phase-routes.ts` | create | Phase URL table and the two allowed history moves. | `routeForPhase`, `historyMove` |
| `src/state/SessionProvider.tsx` | create | Reducer, URL sync, extraction, cancellation, session save. | provider |
| `src/app/**` | create | Layout gate, phase pages, API routes. | App Router |
| `src/server/http/` | create | Route factories, error envelope, demo gate, body limit, SSE. | `createExtractHandler`, `createInterpretHandler` |
| `src/server/pipeline.ts` | modify | 110-second deadline, extracted-text budget, abort signal. | `runExtraction` |
| `src/server/model.ts` | modify | Metadata-only deployed logs; local content flag. | `defaultModelLog` |
| `e2e/recorded-kettle.spec.ts` | modify | One server on port 3000; assert phase URLs and interview reload. | Playwright |
| `README.md` | modify | One-process run, public and private deployment checklist. | — |
| `server/index.ts`, `server/http.ts`, `server/env.ts`, `vite.config.ts`, `index.html`, `src/main.tsx`, `src/App.tsx` | delete | Replaced by App Router and route factories. | — |

### Blast radius

| Path | Why sensitive | Plan mode (before implementation) |
|------|----------------|-----------------------------------|
| `src/domain/apply.ts` | Adjudication status feeds readiness and the report | high |
| `src/server/http/` | Error envelope, SSE, demo gate, and body limit are the client contract | high |
| `src/server/pipeline.ts` | Deadline and text budget must fail before a paid call | high |
| `src/session.ts` | A weak schema drops evidence passages or restores a dossier that looks ready | high |
| `src/state/SessionProvider.tsx` | URL, phase, cancellation, and save interact | high |
| `src/screens/ReadinessReport.tsx` | Supporting conflicts must not be painted as blockers | medium |
| `src/server/model.ts` | Content logs can retain supplier text | medium |

## Workflow (for implementers)

1. This file is the type-1 decomposition.
2. For each subtask: **Plan mode** + **planning-subtasks** → type-2 `.cursor/plans/*.plan.md` when **Plan mode** warrants it.
3. **Agent mode**: **test-driven-development** when **`TDD suitable: yes`** (or the TDD slice of **`partial`**).
4. Update this document if reality diverges; add a **Plan changelog** row.

Suggested order: **T1–T2** on the current test runner, then **T3–T10**.

## Subtasks

Dependency notation: `Blocked by: T1` means start after T1 is done.

### T1 — Adjudication keeps evidence status

- [x] **Do:** A documented conflict winner stays confirmed. A user-supplied winner, including a custom typed value, stays user-provided. Both keep the adjudicated marker and the losing candidates. Empty adjudication remains a no-op.
- **Blocked by:** —
- **Plan mode:** high
- **TDD suitable:** yes
- **TDD suitable reason:** Status is a pure domain result with existing tests that currently expect the wrong status.
- **Verification:** `npx vitest run src/domain/apply.test.ts`

### T2 — Report conflict wording

- [x] **Do:** The readiness criterion fails only for essential conflicts. Supporting conflicts render in their own section and say they do not block readiness. An adjudicated user-provided value shows that status, the marker, and retained losers.
- **Blocked by:** T1
- **Plan mode:** medium
- **TDD suitable:** partial
- **TDD suitable reason:** TDD the criterion and the two conflict headings; leave spacing and color to visual check.
- **Verification:** `npx vitest run src/screens/ReadinessReport.test.tsx`

### T3 — Shared upload budget

- [x] **Do:** One module defines 3 files and 4 MiB total. Browser and server reject a sum over the cap, accept one file at the cap, and no longer allow 10 MiB per file. Intake copy says 4 MB total.
- **Blocked by:** —
- **Plan mode:** skip
- **TDD suitable:** yes
- **TDD suitable reason:** The accept and reject boundaries are pure checks with no framework dependency.
- **Verification:** `npx vitest run src/domain/upload-limits.test.ts src/screens/intake-upload.test.ts server/intake.test.ts`

### T4 — Next.js scaffold and import trial

- [x] **Do:** Add the App Router shell, Tailwind, one existing button, `dev` / `build` / `start`, and a throwaway page that imports a domain module ending in `.js`. If that import fails, strip relative `.js` suffixes across `src/` before any later move. Remove the throwaway page.
- **Blocked by:** —
- **Plan mode:** medium
- **TDD suitable:** no
- **TDD suitable reason:** Tooling and a build-resolution spike. No product behaviour.
- **Verification:** `npm run dev` serves the button; `npm run build` succeeds; existing `npx vitest run` still exits 0.

### T5 — Route-handler port

- [x] **Do:** Move HTTP behaviour into factory-built route handlers. Cover the current `server/http.test.ts` cases, `Content-Length` 413, an unexpected throw as `internal-error` with no stack or path, and a fixture `SyntaxError` that stays a server fault. JSON errors apply before the stream starts. After it starts, failures are SSE `error` events. A non-JSON platform failure becomes the client's unexpected-server-error message.
- **Blocked by:** T3, T4
- **Plan mode:** high
- **TDD suitable:** yes
- **TDD suitable reason:** Each response code and stream event is observable through a fake request.
- **Verification:** `npx vitest run src/server/http`

### T6 — Demo gate, deadline, text budget, cancellation, logs

- [x] **Do:** Public demo returns 403 `live-unavailable` for live extract, uploads, and interpret. Extraction aborts at 110 seconds with `extraction-timeout`, including a repair call. Extracted text over `MAX_EXTRACTED_TEXT_CHARS` returns `text-too-large` and does not call the transport. `request.signal` abort stops the pipeline. Deployed logs omit content even when `EVIDENCEREADY_LOG_MODEL_CONTENT=1`; the flag works only off Vercel. `maxDuration` is 120, lowered only if the plan cap requires it, always at least 10 seconds above the deadline.
- **Blocked by:** T5
- **Plan mode:** high
- **TDD suitable:** yes
- **TDD suitable reason:** Each bound is a handler or pipeline outcome that can be forced with fakes and fake timers.
- **Verification:** `npx vitest run src/server/http src/server/pipeline.test.ts src/server/model.test.ts`

### T7 — Session version 2

- [x] **Do:** Save version, `updatedAt`, phase, counts, failed sources, full interview flags, and citation `surroundingWindow`. Restore that session. Discard intake, extracting, another version, an inconsistent dossier, and a session older than seven days, with the spec's intake notices. Quota or unavailable storage warns: `Progress cannot be saved. Refreshing or closing this page will lose this session.`
- **Blocked by:** T1
- **Plan mode:** high
- **TDD suitable:** yes
- **TDD suitable reason:** Save, load, expiry, and rejection are pure storage behaviour.
- **Verification:** `npx vitest run src/session.test.ts`

### T8 — Phase routes

- [x] **Do:** Map phases to `/`, `/extract`, `/insufficient`, `/interview`, and `/report`. Replace a mismatched URL except the two allowed moves: report to interview dispatches `open-interview`; interview to report dispatches `finish` and keeps applied answers and an existing completion reason.
- **Blocked by:** —
- **Plan mode:** medium
- **TDD suitable:** yes
- **TDD suitable reason:** The table and dispatches are pure once `next/navigation` is mocked.
- **Verification:** `npx vitest run src/state/phase-routes.test.ts`

### T9 — Session provider, pages, and public interview

- [x] **Do:** Gate restore before rendering pages. Push a route after a user phase change, without a second entry during restore. Abort extract and interpret on restart and page leave, and ignore late results. Public interview applies a direct answer and shows the one-field guidance instead of calling interpret. Drafts and unaccepted proposals are not in the saved session.
- **Blocked by:** T4, T6, T7, T8
- **Plan mode:** high
- **TDD suitable:** partial
- **TDD suitable reason:** TDD URL sync, cancellation, restore notices, and the guidance branch. Chrome layout stays a visual check.
- **Verification:** `npx vitest run src/state src/screens/InterviewWorkspace.test.tsx`

### T10 — Cutover

- [x] **Do:** Delete the Vite and Hono entry points. Point Playwright at `http://localhost:3000` and one `npm run dev`. The smoke asserts intake, interview, and report URLs, then reloads on `/interview` and still shows the question. README documents both deployments, the All Deployments protection requirement, the verified duration cap, and the text-budget stand-in if the model card was unavailable.
- **Blocked by:** T2, T9
- **Plan mode:** medium
- **TDD suitable:** partial
- **TDD suitable reason:** The Playwright path is the test. README and deletion are verification, not a new failing unit.
- **Verification:** `npm test`, `npm run test:e2e`, `npm run typecheck`, `npm run build`

## TDD note (Agent mode)

Per subtask, obey **`TDD suitable`**. **`yes`** means strict test-driven development. **`partial`** applies it only to the named behaviour. **`no`** means satisfy **Verification** without a red test first. Moving a file whose tests already pass is a refactor and does not need a new failing test.

## Plan changelog

| Date | Change |
|------|--------|
| 2026-09-27 | Initial plan from the reviewed Next.js migration spec |
