---
status: accepted
date: 2026-08-28
---

# Report authoring readiness, not legal compliance

The assessment audience is Pergamon’s CTO, and the product sits next to GPSR, CE, and EN 82079-1 messaging. A compliance score would be the obvious demo flourish and the wrong claim: we are not encoding live regulations, we are not lawyers, and a half-page of kettle fields cannot certify market entry. EvidenceReady reports whether the **product dossier is ready to enter a manual-authoring workflow**.

## Considered Options

- **Authoring-readiness report (chosen).** Ready only when no high-priority field is missing, no conflict remains, and every high-priority value is document-confirmed or explicitly user-provided. Otherwise: needs evidence review, with the exact blockers listed. No percentage score.
- **Compliance or completeness score.** Looks quantitative in a five-minute demo, overclaims legal coverage, and invites the interviewer to poke holes we cannot close in 18 hours.
- **Hand off a generated manual outline.** Tempting “what’s next” artifact; pulls scope into authoring, which we deliberately left out.

## Consequences

UI copy, `PROPOSAL.md`, and the live demo must say “information completeness / authoring readiness,” never “EU-compliant.” User-provided values stay visually distinct from document-confirmed ones. Field importance is a prototype workflow ranking, not a statement that the field is legally mandatory.

## Clarification

2026-09-27: an unadjudicated conflict blocks readiness only when its field is essential. A supporting conflict stays visible and never blocks readiness. This matches the supporting-field rule that those fields enrich the dossier without blocking it.
