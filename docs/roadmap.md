# EvidenceReady roadmap

Personal-project sequence after the assessment. `PROPOSAL.md` stays the historical record. Current limitations live in [limitations.md](./limitations.md).

Pergamon authoring, PIM, or ERP integration is not in this sequence. Multi-user review is not either: it needs accounts, which the Next.js migration left out.

## Status

| # | Sub-project | Status |
| --- | --- | --- |
| 1 | Next.js migration | Done |
| 2 | Quality baseline | Done, with two deferred leftovers |
| 3 | Model harness and metrics | Not started |
| 4 | Multi-category blueprints | Not started |
| 5 | Field semantics | Not started |
| 6 | Richer inputs | Not started |
| 7 | Persistence and re-checks | Not started |

Build 3 before 5. A semantic quote check needs a measured model path before it ships. 4, 6, and 7 stay in the order above.

## 1. Next.js migration

Done. Spec: [2026-09-27-nextjs-migration-design.md](./superpowers/specs/2026-09-27-nextjs-migration-design.md). Plan: [2026-09-27-nextjs-migration-plan.md](./superpowers/plans/2026-09-27-nextjs-migration-plan.md).

One Next.js app on port 3000. A public deployment replays the bundled kettle path with no model call. A protected private deployment runs live extraction and answer interpretation. Sessions stay in the browser for seven days.

## 2. Quality baseline

Done. Spec: [2026-10-10-quality-baseline-design.md](./superpowers/specs/2026-10-10-quality-baseline-design.md). Plan: [2026-10-10-quality-baseline-plan.md](./superpowers/plans/2026-10-10-quality-baseline-plan.md).

Typed live-model errors and recovery actions, the `server/` move into `src/server/`, the named test gaps, and the prototype pass for the listed screens.

Two findings were deferred and are still open:

- `src/server/model.ts`, `pipeline.ts`, `pdf.ts`, and `intake.ts` do not import `server-only`.
- A private JSON extract body with `mode: "live"` returns `invalid-intake` and does not run the pipeline.

## 3. Model harness and metrics

Not started.

Pin a model, capture fixtures, and compare schema-valid output so a vendor swap is measured. Score extraction accuracy, unsupported-citation rate, unresolved-field rate, and time to authoring readiness. No compliance score.

## 4. Multi-category blueprints

Not started.

Add a second product category as another declarative field table. Prompts, question ranking, and readiness follow that table. A document that does not match the selected category is not scored as a kettle.

## 5. Field semantics

Not started. Depends on sub-project 3.

- Quote verification checks that the cited text supports the value, not only that the quote appears on the named page.
- A field can be not applicable, instead of missing, when the product does not have that fact.
- Two different prose values for one field are a conflict to resolve.

## 6. Richer inputs

Not started.

Accept rating-label photos, spreadsheets, and OCR-backed documents. This sub-project revisits the 4 MiB request-body limit. The migration kept direct uploads under that cap and left browser-to-blob uploads for later.

## 7. Persistence and re-checks

Not started.

Store a session on the server so it survives a different browser. Re-run evidence checks when a source document or the product specification changes.
