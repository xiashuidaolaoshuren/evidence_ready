---
status: accepted
date: 2026-08-28
---

# Resolve every disagreement through the interview

Conflicts could have been resolved by clicking them in the dossier panel, leaving the agent to handle only gaps. Instead, a conflict is a question, ranked ahead of missing and unverified values, and the dossier panel stays read-only. There is one resolution surface, one question budget, and one set of state transitions — and the agent is visibly the thing that decides a contradiction between two evidenced sources matters more than an empty field.

## Considered Options

- **Conflicts are questions (chosen).** One interaction model. Ranking is essential before supporting, then conflict before missing before unverified, then declaration order. That ordering happens to open the bundled demo on its strongest moment.
- **Direct manipulation in the dossier panel.** Faster for an expert user, but the agent stops driving the highest-value work and becomes a gap-filler, and two resolution paths need building and testing.
- **Both.** Best usability, roughly double the state transitions, and two places where a value can change.

## Consequences

A conflict consumes a question from the budget, so the budget bounds total interactions rather than gaps alone.

An answer that contradicts a document-confirmed value creates a conflict instead of overwriting it. That forces the definition wider: a conflict is between *candidates*, and a candidate may be evidence-backed or asserted by the user. A product manager correcting a supplier document from their own purchase order is adjudicated exactly like two documents disagreeing, and both sides are retained.

Adjudicated values stay `confirmed` with a marker rather than becoming a sixth status, so readiness remains a five-value switch. The candidate that lost is kept and shown in the report — a traceability tool that deletes the evidence it decided against is arguing against itself.

The dossier panel navigates and displays but never edits. Inline editing would reintroduce the second resolution path this decision exists to avoid.

## Later narrowing

ADR 0006 narrows the consequence that every adjudicated value stays confirmed. A documented winner stays confirmed. A value the user supplies stays user-provided. Both remain marked adjudicated, and the losing candidates are retained.
