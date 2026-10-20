---
status: accepted
date: 2026-10-20
---

# Keep one model per dossier and review flagged sources before readiness

A second blueprint needs a rule for the wrong document. The user selects one product category. Each dossier covers one product model. Documents are judged separately for category compatibility and for a connection to that model. Extraction continues from accepted documents and from category-neutral sources. A flagged source must be excluded or accepted before the dossier is authoring-ready. Accepting a source permits extraction. It does not confirm the values drawn from it.

## Considered Options

- **User-selected category, one model, per-document review (chosen).** The model may flag a mismatch. It cannot change the category or treat two models as one dossier. Family instructions may contribute where they explicitly apply to the selected model.
- **Infer the category, or stop at a category check.** Faster intake, and a kettle manual can still be scored as a toaster, or two toaster models can be merged.
- **Pause all extraction until every flag is resolved.** Avoids using a partial set, and blocks work that the accepted documents could already support.
- **Warn and continue.** The dossier can look ready while a conflicting product manual was never reviewed.
- **Multi-model dossiers.** Useful for a product family, and a different product from the one this sequence is building.

## Consequences

This narrows [ADR 0003](./0003-authoring-readiness-not-compliance.md). Authoring readiness gains a source-review condition. Supporting-field disagreements stay visible and still do not block readiness. A not-applicable field needs no value.

The second category is a household, mains-powered pop-up bread toaster. Its essential fields are the kettle essentials other than capacity, plus slot count. Slot count is the number of bread openings, not how many slices fit. Operating steps stay supporting in both categories, so readiness still means enough information to begin authoring. Toaster ovens, commercial toasters, and multi-model dossiers are outside this decision.
