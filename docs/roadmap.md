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

Not started. Scope: [2026-10-20-measurement-blueprints-semantics-design.md](./superpowers/specs/2026-10-20-measurement-blueprints-semantics-design.md).

Measure extraction and answer interpretation against human-reviewed expectations. Record semantic failures one case at a time; a new unsupported confirmation or an invented interview proposal blocks a model change. Report latency and review workload separately from human time to readiness. This sub-project measures the failures. It does not ship the semantic check.

## 4. Multi-category blueprints

Not started. Scope: the same spec.

Add a household pop-up toaster blueprint. The user selects one category, and each dossier covers one product model. Judge documents individually. Accepted documents can proceed, and a flagged source blocks readiness until the user reviews it. Slot count replaces kettle capacity as the category-specific essential. Operating steps stay supporting.

## 5. Field semantics

Not started. Depends on sub-project 3. Scope: the same spec. Decisions: [ADR 0007](./adr/0007-bounded-semantic-check-may-confirm.md) and [ADR 0008](./adr/0008-one-model-and-reviewed-sources.md).

Cited passages must support the whole value. A bounded semantic check may authorize confirmation only after its benchmark passes. An explicit "no", a missing value, and a not-applicable field stay distinct. Differing prose and complete accounts require review; additive lists may combine. A partially supported candidate stays unverified.

## 6. Richer inputs

Not started.

Accept rating-label photos, spreadsheets, and OCR-backed documents. This sub-project revisits the 4 MiB request-body limit. The migration kept direct uploads under that cap and left browser-to-blob uploads for later.

## 7. Persistence and re-checks

Not started.

Store a session on the server so it survives a different browser. Re-run evidence checks when a source document or the product specification changes.
