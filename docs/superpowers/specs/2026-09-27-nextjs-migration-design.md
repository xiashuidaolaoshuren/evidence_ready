# Next.js Migration Design

**Date:** 2026-09-27
**Status:** Approved after review
**Sub-project:** 1 of 7. Later sub-projects (quality baseline, model harness and metrics, multi-category blueprints, field semantics, richer inputs, persistence and re-checks) are out of scope here.

EvidenceReady today is a Vite single-page app plus a separate Hono server. This migration keeps the evidence-intake behaviour and moves the app onto Next.js so it runs as one process and can deploy to Vercel. Domain vocabulary is defined in [`CONTEXT.md`](../../../CONTEXT.md). Hosting choices are recorded in [ADR 0005](../../adr/0005-nextjs-on-vercel.md). The adjudication correction is recorded in [ADR 0006](../../adr/0006-adjudication-keeps-evidence-status.md).

## 1. Decisions

| Decision | Choice |
| --- | --- |
| Host | Vercel |
| Audiences | A public recorded demo and a separate protected private deployment for live use |
| Upload budget | At most 3 files, 4 MiB total, checked in the browser and on the server |
| Extracted text | Reject before the model call when extracted text exceeds one request |
| Live deadline | 110 seconds for the whole extraction, inside a 120-second function limit |
| HTTP layer | Native Next.js route handlers on the Node.js runtime. Hono is removed |
| Front-end routes | One route per phase. The reducer phase is the source of truth; the URL follows it |
| History | Browser Back and Forward move between interview and report without discarding applied answers |
| Refresh | Resume a version 2 saved session. A refresh during extraction returns to intake |
| Retention | A saved session expires after seven days without activity |
| Abandoned work | Attempt to cancel outstanding extraction and interpretation; discard late results |
| Logs | Production logs contain operational metadata. Content logging is local and explicit |
| Assessment record | `PROPOSAL.md` is left unchanged |

## 2. Goals and non-goals

### 2.1 Goals

- Run the whole app with `npm run dev` and deploy it to Vercel with `next build`.
- Keep extraction, reconciliation, the interview, proposals, and the readiness report behaving as they do now, except the changes in section 12.
- On the public deployment, complete the bundled kettle path with no model call: recorded extraction, direct interview answers, and the readiness report.
- On the private deployment, keep live extraction and answer interpretation working when `OPENROUTER_API_KEY` is set.
- Give each phase its own URL, and resume a saved session after refresh.
- Keep every HTTP error in the JSON envelope the UI already parses, until a stream has started.

### 2.2 Non-goals

- New dossier behaviour beyond the adjudication-status correction, new file types, OCR, a second product category, or a model harness.
- A database, accounts, or cross-device persistence. The session stays in `localStorage`.
- Application login. The private deployment uses Vercel Authentication.
- Two open tabs. They share one storage key and the last write wins.
- Rewriting screen components or the reducer, except the session, limit, demo, report-wording, and cancellation changes named in this spec.
- Splitting an oversized document across multiple model calls.
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
    app-state.ts                current reducer, moved unchanged except where a spec change says otherwise
    session.ts
    phase-routes.ts
    SessionProvider.tsx
  screens/                      current screen components
  domain/                       unchanged except adjudication status, plus upload-limits.ts
  server/                       pipeline, model, pdf, intake, and route factories
fixtures/                       unchanged
```

`server/index.ts`, `server/env.ts`, `server/http.ts`, `vite.config.ts`, `index.html`, and `src/main.tsx` are deleted. Next.js loads `.env.local` itself, so the hand-rolled env loader goes away with its tests.

Server modules start with `import "server-only"` so the API key and pipeline cannot land in the client bundle.

## 4. Two deployments

The same build serves both audiences. `EVIDENCEREADY_PUBLIC_DEMO=1` selects the public demo. The private deployment leaves that variable unset and sets `OPENROUTER_API_KEY`.

Public demo:

- Intake offers the bundled recorded example only. The live choice and the upload form are absent. Copy says live extraction and a visitor's own documents are not part of this demo.
- `POST /api/extract` accepts only `{ source: "fixture", mode: "recorded" }`. A live fixture request or a multipart upload returns HTTP 403 `{ error: { code: "live-unavailable", message: "Live extraction is not available in this demo." } }`.
- `POST /api/interpret` returns the same status and code, with message `Answer interpretation is not available in this demo.`
- When an interview answer needs interpretation, the interview explains that this demo takes one field at a time and asks for only that field's value. It does not call the API. A direct value is still applied. An empty answer still declares the field unavailable.

Private deployment:

- Live extraction, uploads, and answer interpretation stay available.
- The project enables Vercel Authentication with scope **All Deployments**, covering preview, production, and API routes. Standard Protection is not enough, because it leaves production domains public.
- The app does not add its own login screen.

## 5. Routes and phase

`src/state/phase-routes.ts` is the only phase-to-URL map.

| Phase | Route |
| --- | --- |
| `intake` | `/` |
| `extracting`, `extracted` | `/extract` |
| `insufficient` | `/insufficient` |
| `interview` | `/interview` |
| `report` | `/report` |

The same module lists allowed history moves:

- `report` → `interview` dispatches the existing `open-interview` action.
- `interview` → `report` dispatches the existing `finish` action.

Both keep the latest dossier and interview progress. `finish` does not replace a completion reason that is already set. Opening `/report` from the interview is the same outcome as **Finish and view report**. Opening `/interview` from the report is the same outcome as **Back to interview**.

Each page is a client component that reads state and dispatch from the provider and renders the existing screen. Props match what `App.tsx` passes today. `App.tsx` is deleted. One chrome component draws the header, mode badge, restart button, storage warning, and footer. The gate renders that chrome in both states: while restoring, it shows the intake chrome (no badge, no restart); after the provider mounts, it shows the chrome for the current session. Extraction, retry, the generation counter, cancellation, and session save live in `SessionProvider`. The `window.scrollTo` effect is dropped because the App Router scrolls to the top on navigation.

The provider keeps the URL and the phase together. It does this only after the first commit, so restoring a session does not push a second history entry on top of the replace in section 6.

- When the phase changes because the user did something, and the URL is not already that phase's route, the provider pushes the route. The back button then has an entry.
- When the URL does not match the phase (typed URL, refresh, or back/forward), an allowed history move is dispatched. Any other mismatch replaces the URL with the route for the current phase. Back from `/interview` to `/extract` returns the address bar to `/interview` and leaves the dossier where it was.

## 6. Saved session

The wipe-on-load in `App.tsx` is removed. The session is cleared only by **Restart session**, by a restore that decides the stored value cannot be resumed, and by expiry.

Stored shape, version 2:

- `version: 2`
- `updatedAt`: an ISO timestamp rewritten on every successful save
- `phase`: the app phase, including `extracted`. This is separate from `interview.phase`, which can be `interview` while the app phase is still `extracted`.
- `mode`, `dossier`, `rejected`, `interview`, `excerpts`
- `counts` and `failedSources`, so the extraction summary and the insufficient-evidence screen can render after refresh
- `interview` validates the full `InterviewState`, including the optional flags the reducer already writes (`pausedForBudget`, `essentialsClear`, `continueSupporting`, `exhaustedFieldKeys`). Resume must not drop a budget pause.
- Conflict-candidate and loser citations keep `surroundingWindow` when it is present. A round trip must not strip that passage.

`error` and `progress` are not stored. A stream cannot be resumed, and the `File` objects for a retry are not stored. Typed drafts and unaccepted proposals live in component state and are discarded on refresh. The UI says that refresh keeps applied dossier changes and interview progress, and does not keep an unfinished answer or an unaccepted proposal.

Restore runs once, on the client, before any page renders:

1. A gate in the layout reads storage after mount. Until that read finishes, the gate renders the header and footer and does not mount the provider or the page. Pages read context only after the provider exists. That avoids a hydration mismatch and a flash of intake.
2. Missing data, a failed parse, a version other than 2, or phase `intake` or `extracting` is discarded. Storage is cleared and the provider mounts at the initial intake state. The URL is replaced with `/` when it is not already `/`. Phase `extracting` covers both an in-flight run and a failed run still sitting on the progress screen.
3. A version 2 value that parses but fails a consistency check is discarded with the intake notice `The saved session could not be restored.` The dossier must contain each kettle field exactly once. Every interview field key must name a kettle field. `updatedAt` must be a parseable timestamp. A timestamp in the future is treated as just written.
4. A consistent session whose `updatedAt` is more than seven days old is discarded with the intake notice `The saved session expired after seven days without activity.` Expiry is checked when the app next runs. A closed browser does not clear it on a schedule.
5. Any other valid version 2 session becomes the provider's initial state. The URL is replaced with that phase's route. The reducer itself gains no new action; the gate passes the restored state into `useReducer`'s initializer.
6. The save effect still writes every non-intake phase, including `extracting`. Restore is what discards that value.

When browser storage throws a quota error, or storage is unavailable, the app keeps the session in memory and shows a persistent warning: `Progress cannot be saved. Refreshing or closing this page will lose this session.` The warning does not claim that progress survives refresh.

## 7. API routes

Each route exports `runtime = "nodejs"` and `dynamic = "force-dynamic"`. Extract and interpret also export `maxDuration = 120`. Before release, that value is checked against the deployment's plan cap. If the cap is lower, both `maxDuration` and the extraction deadline are lowered together, leaving at least 10 seconds between them, and the README states the verified numbers.

Handlers are built by factories in `src/server/http/`, with the same dependency slots as today's `HttpDeps`: fixture directory, API key, model transport, extraction function, interpret function, and the public-demo flag. The default dependencies read `process.env` on each request. Tests call the factory with fakes and invoke the handler with `new Request(...)`.

`withErrorEnvelope` wraps every handler. An unexpected throw becomes HTTP 500 `{ error: { code: "internal-error", message: "Unexpected server error." } }` with no stack and no filesystem path. Request-body Zod failures stay HTTP 400 `invalid-request`. A `SyntaxError` is a client error only when it is thrown while parsing the request body. The same error while reading a fixture stays a server fault.

An application error before the first stream byte uses that JSON envelope. After the progress stream has started, a failure is an `error` event and the stream then closes. If the stream ends without a result or an error event, or the platform returns a non-JSON failure such as a function timeout page, the client shows the existing unexpected-server-error message rather than a raw parse failure.

Streaming progress otherwise moves unchanged. `extractionSseResponse` already returns a web `Response` over a `ReadableStream` of `text/event-stream` events (`stage`, `result`, `error`).

The extraction pipeline, including a malformed-JSON repair call, aborts at 110 seconds and emits `error` with code `extraction-timeout` and message `Extraction took too long. Try again.` Retry stays manual. The handler also stops when `request.signal` aborts. The client aborts its extract and interpret requests on **Restart session** and when the page is leaving. A response that arrives after cancellation or after a newer request has started is ignored. Cancellation is best-effort: work the provider has already accepted can still be charged.

Before a live model call, the pipeline measures the extracted document text. If it exceeds `MAX_EXTRACTED_TEXT_CHARS`, extraction fails with code `text-too-large` and message `These documents are too long for one extraction. Submit fewer or shorter documents.` The constant is set from the model's published input limit minus the fixed field catalog and instructions. If that published limit cannot be verified, the constant is 100,000 characters and the README says the number is a stand-in. The model transport is not called.

Fixtures resolve from `process.cwd()/fixtures/kettle`. `next.config.ts` sets `outputFileTracingIncludes` so those files ship inside the extract function.

`GET /api/health` returns the text `ok`. Playwright waits on it. There is no `/health` route.

Model logs in a deployed environment record the model identifier, HTTP status, duration, finish reason, and error code. They omit prompt text, document text, answers, and response excerpts. `EVIDENCEREADY_LOG_MODEL_CONTENT=1` adds those excerpts only when the process is not running on Vercel. A deployed environment ignores the flag.

## 8. Upload budget

One module, `src/domain/upload-limits.ts`, replaces the duplicated constants in `src/screens/intake-upload.ts` and `server/intake.ts`.

- `MAX_UPLOAD_COUNT = 3`
- `MAX_TOTAL_UPLOAD_BYTES = 4 * 1024 * 1024`
- Each file must be at most the total, and the sum of file sizes must be at most the total. One 4 MiB file is accepted. Two files that sum past 4 MiB are rejected.
- Accepted types stay PDF and TXT.

The browser checks before sending. The intake line that says "10 MB each" becomes "4 MB total". The rejection message names the 4 MB total limit. The rest of the intake copy is left for the later UI pass, apart from the public-demo change in section 4.

The server checks `Content-Length` before parsing and returns HTTP 413 `{ error: { code: "payload-too-large", message: "Request body too large." } }` when the header exceeds the total plus 64 KiB of multipart overhead. If the header is absent, parsing proceeds and `validateIntakeUploads` enforces count, per-file, and total limits. On Vercel the platform can reject an oversized body before the handler runs; the browser check is the message the user sees, and the handler check is defense in depth for `next start` and for clients that skip the UI.

## 9. Authoring readiness wording

The readiness rule stays the one already tested: only an essential field can block, and a supporting conflict does not. The report stops treating every conflict as blocking.

- The pass/fail criterion counts essential conflicts only.
- Essential conflicts keep a heading that says they block readiness.
- Supporting conflicts appear separately, with copy that they do not block readiness.
- An adjudicated user-provided value shows the user-provided status, the adjudicated marker, and the retained losers. A documented winner still shows confirmed.

## 10. Tooling

- Add `next`, `server-only`, and `@tailwindcss/postcss`. Remove `hono`, `@hono/node-server`, the Vite app dependency, and `@tailwindcss/vite`. Keep `vite` only as the Vitest runner if the test config still imports it through `vitest/config`. Keep `@vitejs/plugin-react` for component tests.
- `src/index.css` becomes `src/app/globals.css`. `components.json` points at the new file and sets `"rsc": true`.
- `tsconfig.json` uses the Next.js plugin and `"jsx": "preserve"`, keeps the `@/*` alias and `verbatimModuleSyntax`, and drops `vite.config.ts` from `include`.
- Scripts are `dev`, `build`, and `start` (Next.js), plus the existing `test`, `test:e2e`, and `typecheck`. `dev:server` is removed.
- Vitest's `include` drops the `server/**/*.test.ts` glob once those tests live under `src/`. `src/**/*.test.ts` and `src/**/*.test.tsx` cover them.
- Domain and server imports use a `.js` suffix (`./types.js`). The first implementation step is a throwaway page that imports one such module. If Next.js does not resolve it, relative `.js` suffixes are stripped across `src/` before any other move. That strip is mechanical and does not change behaviour.
- The provider, the session gate, and the page files are `"use client"`. Screen files are not given a directive unless a build error requires it.

Playwright's `baseURL` becomes `http://localhost:3000`. Its `webServer` is a single `npm run dev`, ready when `http://localhost:3000/api/health` returns ok. The smoke runs as the public demo.

## 11. Testing

New behaviour is test-first. Moving a file while its tests stay green is a refactor and does not need a new failing test.

Existing domain, screen, pipeline, and fixture tests pass with import paths updated and nothing else, except tests rewritten for section 12. These cases are new or rewritten:

- Route-handler tests cover every case now in `server/http.test.ts`, plus the `Content-Length` 413, the error envelope for an unexpected throw, a fixture `SyntaxError` that must not become `invalid-request`, public-demo rejection of live extract and interpret, the 110-second timeout, extracted text over the constant, and abort when the request signal aborts.
- The text-budget test shows the model transport is not called.
- Upload-limit tests, browser and server, cover the 4 MiB total: one file at the cap passes, the sum over the cap fails, and the old per-file 10 MiB allowance is gone.
- Phase-route tests cover the table, a mismatched URL being replaced, report-to-interview dispatching `open-interview`, and interview-to-report dispatching `finish` without dropping applied answers. `next/navigation` is mocked.
- Session tests cover version 2 round-trip, `surroundingWindow` on a conflict citation, dropping a missing or other version, discarding `extracting` back to intake, restoring `extracted` with `counts`, keeping `pausedForBudget`, rejecting an inconsistent dossier, expiring a session older than seven days, and the quota warning copy.
- Adjudication tests cover a documented winner staying confirmed and a user-supplied winner staying user-provided, with losers retained in both cases.
- Report tests cover an essential conflict blocking the criterion and a supporting conflict remaining visible without blocking it.
- Interview tests cover the public demo applying a direct answer and showing the one-field guidance instead of calling interpret.
- Log tests cover a deployed environment omitting response content even when the local flag is set.
- The Playwright smoke walks the recorded kettle path, asserts the URL at intake, interview, and report, and reloads on `/interview` to confirm the question is still there.
- `next build` succeeds. A client import of a `server-only` module must fail that build.

A private-deployment preview check is manual: Vercel Authentication challenges every URL, and live extraction completes when the key is set. The public preview has no key, and its live endpoints return `live-unavailable`.

## 12. Migration order

1. Correct adjudication status and readiness-report conflict wording. These are domain and copy changes, and they do not wait for Next.js.
2. Scaffold Next.js, wire Tailwind and one existing button, and run the `.js` import trial.
3. Add the shared upload limit, then move server code and add the route handlers. Port `http.test.ts` before the handlers exist. Add the demo gate, deadline, text budget, cancellation, and metadata logging with their tests.
4. Add the session gate, the phase-route table, the provider, and the pages. Session and route tests come before the production code they describe.
5. Delete the Vite and Hono entry points, point Playwright at one server, and update `README.md`.

ADR 0005 and ADR 0006 are already accepted.

## 13. Done when

- `npm run dev` serves the app, including `/api/extract`, `/api/interpret`, and `/api/health`.
- The public configuration completes the recorded kettle path locally and on a Vercel preview, with no API key and with live endpoints returning `live-unavailable`.
- The private preview challenges every URL, including production and `/api/*`. Live extraction completes there when `OPENROUTER_API_KEY` is set.
- Refresh on `/interview` and `/report` restores the dossier and stays on that route. An unaccepted proposal is gone. Refresh on `/extract` during a run lands on `/` with an empty session.
- Browser Back and Forward between interview and report keep the latest applied answers.
- An upload whose files sum past 4 MiB is rejected in the browser and never sent.
- A user-supplied adjudication winner is user-provided. A documented winner is confirmed.
- `npm test`, `npm run test:e2e`, `npm run typecheck`, and `npm run build` pass.

## 14. Explicit behaviour changes

Everything not in this list stays as it is.

| Today | After |
| --- | --- |
| Two processes, ports 5173 and 8787 | One Next.js process, port 3000 |
| One local audience | Public recorded demo, or protected private live use, selected by deployment |
| Up to 3 files, 10 MiB each | Up to 3 files, 4 MiB total, plus an extracted-text limit before a model call |
| No extraction deadline | Stop after 110 seconds and offer a manual retry |
| Abandoned requests run to completion | Best-effort cancellation; late results are discarded |
| Refresh clears the session and shows intake | Refresh resumes a version 2 session for seven days, except during extraction |
| Storage failure says progress survives refresh while the tab stays open | Storage failure warns that refresh or closing loses the session |
| One URL for every phase | The routes in section 5 |
| Back from report returns to interview; Forward is rejected | Back and Forward both work between interview and report |
| A user-typed adjudication winner is confirmed | That winner is user-provided; a documented winner stays confirmed |
| Any conflict can fail the report criterion | Only an essential conflict blocks; a supporting conflict stays visible |
| Model logs can include a 500-character response excerpt | Deployed logs are metadata only |
| `GET /health` on the Hono port | `GET /api/health` |
