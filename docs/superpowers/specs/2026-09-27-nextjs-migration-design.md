# Next.js Migration Design

**Date:** 2026-09-27
**Status:** Approved for implementation planning
**Sub-project:** 1 of 7. Later sub-projects (quality baseline, model harness and metrics, multi-category blueprints, field semantics, richer inputs, persistence and re-checks) are out of scope here.

EvidenceReady today is a Vite single-page app plus a separate Hono server. This migration keeps the evidence-intake behaviour and moves the app onto Next.js so it runs as one process and can deploy to Vercel. Domain vocabulary is defined in [`CONTEXT.md`](../../../CONTEXT.md).

## 1. Decisions

| Decision | Choice |
| --- | --- |
| Host | Vercel |
| Upload budget | At most 3 files, 4 MiB total, checked in the browser and on the server |
| HTTP layer | Native Next.js route handlers on the Node.js runtime. Hono is removed |
| Front-end routes | One route per phase. The reducer phase is the source of truth; the URL follows it |
| Refresh | Resume from a version 2 saved session. A refresh during extraction returns to intake |
| Assessment record | `PROPOSAL.md` is left unchanged |

## 2. Goals and non-goals

### 2.1 Goals

- Run the whole app with `npm run dev` and deploy it to Vercel with `next build`.
- Keep extraction, reconciliation, the interview, proposals, and the readiness report behaving as they do now.
- Keep recorded extraction working with no API key, and live extraction working when `OPENROUTER_API_KEY` is set.
- Give each phase its own URL, and resume a saved session after refresh.
- Keep every HTTP error in the JSON envelope the UI already parses.

### 2.2 Non-goals

- New dossier behaviour, new file types, OCR, a second product category, or a model harness.
- A database, accounts, or cross-device persistence. The session stays in `localStorage`.
- Two open tabs. They share one storage key and the last write wins.
- Rewriting screen components, the domain control plane, or the reducer, except the session and limit changes named in this spec.
- Updating `PROPOSAL.md`. It stays the historical assessment record. Run instructions for the personal project live in `README.md`.

## 3. Layout

```text
src/
  app/
    layout.tsx                  html shell and the session gate
    globals.css                 current src/index.css
    page.tsx                    intake
    extract/page.tsx            extracting and extracted
    insufficient/page.tsx
    interview/page.tsx
    report/page.tsx
    api/extract/route.ts
    api/interpret/route.ts
    api/health/route.ts
  state/
    app-state.ts                current reducer, moved unchanged
    session.ts
    phase-routes.ts
    SessionProvider.tsx
  screens/                      current screen components
  domain/                       unchanged, plus upload-limits.ts
  server/                       pipeline, model, pdf, intake, and route factories
fixtures/                       unchanged
```

`server/index.ts`, `server/env.ts`, `server/http.ts`, `vite.config.ts`, `index.html`, and `src/main.tsx` are deleted. Next.js loads `.env.local` itself, so the hand-rolled env loader goes away with its tests.

Server modules start with `import "server-only"` so the API key and pipeline cannot land in the client bundle.

## 4. Routes and phase

`src/state/phase-routes.ts` is the only phase-to-URL map.

| Phase | Route |
| --- | --- |
| `intake` | `/` |
| `extracting`, `extracted` | `/extract` |
| `insufficient` | `/insufficient` |
| `interview` | `/interview` |
| `report` | `/report` |

The same module lists allowed history moves. The only one is `report` → `interview`, which dispatches the existing `open-interview` action. That is the current "Back to interview" button.

Each page is a client component that reads state and dispatch from the provider and renders the existing screen. Props match what `App.tsx` passes today. `App.tsx` is deleted. One chrome component draws the header, mode badge, restart button, storage warning, and footer. The gate renders that chrome in both states: while restoring, it shows the intake chrome (no badge, no restart); after the provider mounts, it shows the chrome for the current session. Extraction, retry, the generation counter, and session save live in `SessionProvider`. The `window.scrollTo` effect is dropped because the App Router scrolls to the top on navigation.

The provider keeps the URL and the phase together. It does this only after the first commit, so restoring a session does not push a second history entry on top of the replace in section 5.

- When the phase changes because the user did something, and the URL is not already that phase's route, the provider pushes the route. The back button then has an entry.
- When the URL does not match the phase (typed URL, refresh, or back/forward), an allowed history move is dispatched. Any other mismatch replaces the URL with the route for the current phase. Back from `/interview` to `/extract` returns the address bar to `/interview` and leaves the dossier where it was.

## 5. Saved session

The wipe-on-load in `App.tsx` is removed. The session is cleared only by "Restart session", which returns to intake, and by a restore that decides the stored value cannot be resumed.

Stored shape, version 2:

- `version: 2`
- `phase`: the app phase, including `extracted`. This is separate from `interview.phase`, which can be `interview` while the app phase is still `extracted`.
- `mode`, `dossier`, `rejected`, `interview`, `excerpts` (as today)
- `counts` and `failedSources`, so the extraction summary and the insufficient-evidence screen can render after refresh
- `interview` validates the full `InterviewState`, including the optional flags the reducer already writes (`pausedForBudget`, `essentialsClear`, `continueSupporting`, `exhaustedFieldKeys`). Resume must not drop a budget pause.

`error` and `progress` are not stored. A stream cannot be resumed, and the `File` objects for a retry are not stored.

Restore runs once, on the client, before any page renders:

1. A gate in the layout reads storage after mount. Until that read finishes, the gate renders the header and footer and does not mount the provider or the page. Pages read context only after the provider exists. That avoids a hydration mismatch and a flash of intake.
2. Missing data, a failed parse, a version other than 2, or phase `intake` or `extracting` is discarded. Storage is cleared and the provider mounts at the initial intake state. The URL is replaced with `/` when it is not already `/`. Phase `extracting` covers both an in-flight run and a failed run still sitting on the progress screen.
3. Any other valid version 2 session becomes the provider's initial state. The URL is replaced with that phase's route. The reducer itself gains no new action; the gate passes the restored state into `useReducer`'s initializer.
4. The save effect still writes every non-intake phase, including `extracting`. Restore is what discards that value.

## 6. API routes

Each route exports `runtime = "nodejs"` and `dynamic = "force-dynamic"`. Extract and interpret also export `maxDuration = 60`. The Vercel plan must allow that duration; if the plan's cap is lower, the export is lowered to the cap and the README says so.

Handlers are built by factories in `src/server/http/`, with the same dependency slots as today's `HttpDeps`: fixture directory, API key, model transport, extraction function, interpret function. The default dependencies read `process.env.OPENROUTER_API_KEY` on each request. Tests call the factory with fakes and invoke the handler with `new Request(...)`.

`withErrorEnvelope` wraps every handler. An unexpected throw becomes HTTP 500 `{ error: { code: "internal-error", message: "Unexpected server error." } }` with no stack and no filesystem path. Request-body Zod failures stay HTTP 400 `invalid-request`. A `SyntaxError` is a client error only when it is thrown while parsing the request body. The same error while reading a fixture stays a server fault.

Streaming progress moves unchanged. `extractionSseResponse` already returns a web `Response` over a `ReadableStream` of `text/event-stream` events (`stage`, `result`, `error`).

Fixtures resolve from `process.cwd()/fixtures/kettle`. `next.config.ts` sets `outputFileTracingIncludes` so those files ship inside the extract function.

`GET /api/health` returns the text `ok`. Playwright waits on it. There is no `/health` route.

## 7. Upload budget

One module, `src/domain/upload-limits.ts`, replaces the duplicated constants in `src/screens/intake-upload.ts` and `server/intake.ts`.

- `MAX_UPLOAD_COUNT = 3`
- `MAX_TOTAL_UPLOAD_BYTES = 4 * 1024 * 1024`
- Each file must be at most the total, and the sum of file sizes must be at most the total. One 4 MiB file is accepted. Two files that sum past 4 MiB are rejected.
- Accepted types stay PDF and TXT.

The browser checks before sending. The intake line that says "10 MB each" becomes "4 MB total". The rejection message names the 4 MB total limit. The rest of the intake copy is left for the later UI pass.

The server checks `Content-Length` before parsing and returns HTTP 413 `{ error: { code: "payload-too-large", message: "Request body too large." } }` when the header exceeds the total plus 64 KiB of multipart overhead. If the header is absent, parsing proceeds and `validateIntakeUploads` enforces count, per-file, and total limits. On Vercel the platform can reject an oversized body before the handler runs; the browser check is the message the user sees, and the handler check is defense in depth for `next start` and for clients that skip the UI.

## 8. Tooling

- Add `next`, `server-only`, and `@tailwindcss/postcss`. Remove `hono`, `@hono/node-server`, the Vite app dependency, and `@tailwindcss/vite`. Keep `vite` only as the Vitest runner if the test config still imports it through `vitest/config`. Keep `@vitejs/plugin-react` for component tests.
- `src/index.css` becomes `src/app/globals.css`. `components.json` points at the new file and sets `"rsc": true`.
- `tsconfig.json` uses the Next.js plugin and `"jsx": "preserve"`, keeps the `@/*` alias and `verbatimModuleSyntax`, and drops `vite.config.ts` from `include`.
- Scripts are `dev`, `build`, and `start` (Next.js), plus the existing `test`, `test:e2e`, and `typecheck`. `dev:server` is removed.
- Vitest's `include` drops the `server/**/*.test.ts` glob once those tests live under `src/`. `src/**/*.test.ts` and `src/**/*.test.tsx` cover them.
- Domain and server imports use a `.js` suffix (`./types.js`). The first implementation step is a throwaway page that imports one such module. If Next.js does not resolve it, relative `.js` suffixes are stripped across `src/` before any other move. That strip is mechanical and does not change behaviour.
- The provider, the session gate, and the page files are `"use client"`. Screen files are not given a directive unless a build error requires it.

Playwright's `baseURL` becomes `http://localhost:3000`. Its `webServer` is a single `npm run dev`, ready when `http://localhost:3000/api/health` returns ok.

## 9. Testing

New behaviour is test-first. Moving a file while its tests stay green is a refactor and does not need a new failing test.

Existing domain, screen, pipeline, and fixture tests pass with import paths updated and nothing else. These cases are new or rewritten:

- Route-handler tests cover every case now in `server/http.test.ts`, plus the `Content-Length` 413, the error envelope for an unexpected throw, and a fixture `SyntaxError` that must not become `invalid-request`.
- Upload-limit tests, browser and server, cover the 4 MiB total: one file at the cap passes, the sum over the cap fails, and the old per-file 10 MiB allowance is gone.
- Phase-route tests cover the table, a mismatched URL being replaced, and the report-to-interview history move dispatching `open-interview`. `next/navigation` is mocked.
- Session tests cover version 2 round-trip, dropping a missing or other version, discarding `extracting` back to intake, restoring `extracted` with `counts`, and keeping `pausedForBudget` across save and load.
- The Playwright smoke walks the recorded kettle path, asserts the URL at intake, interview, and report, and reloads on `/interview` to confirm the question is still there.
- `next build` succeeds. A client import of a `server-only` module must fail that build.

## 10. Migration order

1. Scaffold Next.js, wire Tailwind and one existing button, and run the `.js` import trial.
2. Move server code and add the route handlers. Port `http.test.ts` before the handlers exist.
3. Add the session gate, the phase-route table, the provider, and the pages. Session and route tests come before the production code they describe.
4. Delete the Vite and Hono entry points, point Playwright at one server, update `README.md`, and add `docs/adr/0005-nextjs-on-vercel.md`.

ADR 0005 records three choices: Next.js on Vercel rather than a long-running Node host, native route handlers rather than mounting Hono, and a 4 MiB total upload budget rather than browser-to-blob uploads. It names the options that were rejected and the consequence that richer inputs, in a later sub-project, have to revisit the body limit.

## 11. Done when

- `npm run dev` serves the app, including `/api/extract`, `/api/interpret`, and `/api/health`.
- The recorded kettle path completes locally and on a Vercel preview deployment.
- Live extraction completes on that preview when `OPENROUTER_API_KEY` is set in the project environment.
- Refresh on `/interview` and `/report` restores the dossier and stays on that route. Refresh on `/extract` during a run lands on `/` with an empty session.
- An upload whose files sum past 4 MiB is rejected in the browser and never sent.
- `npm test`, `npm run test:e2e`, `npm run typecheck`, and `npm run build` pass.

## 12. Explicit behaviour changes

Everything not in this list stays as it is.

| Today | After |
| --- | --- |
| Two processes, ports 5173 and 8787 | One Next.js process, port 3000 |
| Up to 3 files, 10 MiB each | Up to 3 files, 4 MiB total |
| Refresh clears the session and shows intake | Refresh resumes a version 2 session, except during extraction |
| One URL for every phase | The routes in section 4 |
| `GET /health` on the Hono port | `GET /api/health` |
