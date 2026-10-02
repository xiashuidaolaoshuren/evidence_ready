# EvidenceReady

Evidence intake for product documentation — turns messy supplier documents into a traceable product dossier and reports authoring readiness.

**Read [PROPOSAL.md](./PROPOSAL.md) first.** It explains the problem, architecture, and assessment context. The brief requires assessors to follow the run instructions there literally.

## Quick start

**Prerequisites:** Node.js 20+ and npm

```bash
npm install
npm run dev
```

Open **http://localhost:3000**. Use **Load the bundled example** — no API key required when running as the public demo (see below).

For live extraction or uploads, copy `.env.example` to `.env.local` and set `OPENROUTER_API_KEY`. See [PROPOSAL.md §3](./PROPOSAL.md#3-how-to-run-it) for full instructions.

## Deployment

### Public demo

Set `EVIDENCEREADY_PUBLIC_DEMO=1`. No `OPENROUTER_API_KEY` is required. Live extract, upload, and interpret return HTTP 403 `live-unavailable`. The Playwright smoke runs in this configuration.

### Private deployment

Leave `EVIDENCEREADY_PUBLIC_DEMO` unset and set `OPENROUTER_API_KEY` for live extraction and answer interpretation. Protect **every URL** (including production and `/api/*`) with Vercel Authentication scoped to **All Deployments**.

### Runtime limits

Extract and interpret route handlers export `maxDuration = 120` seconds. Extraction aborts at a **110-second** deadline (including a malformed-JSON repair call). These values have not yet been confirmed against a deployed plan cap; if the cap is lower, both limits are lowered together with at least 10 seconds between them.

Live extraction rejects documents whose extracted text exceeds **100,000 characters** (`MAX_EXTRACTED_TEXT_CHARS`). That limit is a stand-in until the model's published input budget is verified.

## Tests

```bash
npm test
npm run test:e2e
npm run typecheck
npm run build
```
