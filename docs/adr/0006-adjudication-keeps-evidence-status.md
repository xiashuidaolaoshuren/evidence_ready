---
status: accepted
date: 2026-09-27
---

# An adjudicated value keeps the evidence status of the chosen candidate

Choosing among conflicting candidates used to mark the winner confirmed even when the user typed a value no document supported. That contradicted the meaning of confirmed: a value supported by evidence.

## Considered Options

- **Keep the chosen candidate's evidence status (chosen).** A documented winner stays confirmed. A user-supplied winner stays user-provided. Both are marked adjudicated, and every losing candidate is retained. Readiness already treats user-provided as sufficient for an essential field and confirmed as sufficient only with evidence.
- **Leave every adjudicated winner confirmed.** Matches the earlier wording in ADR 0004 and the current tests, and lets a value with no evidence look the same as a value a document supports.
- **Defer the correction to the quality-baseline sub-project.** Keeps the migration behavior-neutral, and ships a known mismatch between the glossary and the dossier.

## Consequences

ADR 0004 still makes the interview the only resolution surface. Its consequence that every adjudicated value stays confirmed is narrowed by this decision. The readiness report shows the resulting status, the adjudicated marker, and the retained losers. A supporting conflict still does not block readiness.
