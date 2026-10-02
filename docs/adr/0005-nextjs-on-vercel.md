---
status: accepted
date: 2026-09-27
---

# Run EvidenceReady as Next.js on Vercel, with a public demo and a private live deployment

EvidenceReady began as a Vite app plus a separate Hono server so the assessment could be run locally. As a personal project it needs one process, a deployable host, and a way to show the bundled kettle path without letting the public spend the OpenRouter key.

## Considered Options

- **Next.js on Vercel, native route handlers, two deployments (chosen).** One App Router app. The public deployment has no API key and serves only the bundled recorded path, including the interview and readiness report. The private deployment holds the key, enables live extraction and answer interpretation, and is protected on every URL, including production and the API. Uploads stay direct and are capped at 3 files and 4 MiB total. Live extraction stops after 110 seconds, inside a 120-second function limit, and refuses extracted text that would not fit one model request.
- **A long-running Node host with the existing Hono server.** Avoids a framework move, but keeps two processes and does not match the chosen host.
- **Mount Hono inside Next.js.** Preserves the current router, while leaving a second HTTP framework in the only process.
- **Browser-to-blob uploads.** Avoids the function body limit, and adds storage, credentials, and cleanup before the richer-inputs work needs them.
- **One public deployment with live model access.** Makes the demo useful for visitors' own documents, and leaves the key open to anyone who can call the endpoints.

## Consequences

Richer inputs have to revisit the 4 MiB body limit. The public demo accepts a direct answer for the current field and explains when an answer would need model interpretation; it never calls the model. Restarting or leaving attempts to cancel outstanding model work, and late results are discarded. Charges already incurred can remain. Production logs keep operational metadata only. Document text, answers, and model-response excerpts are logged only for explicit local debugging, never on a deployed environment. The private project must use Vercel Authentication with the All Deployments scope, because Standard Protection leaves production domains public.
