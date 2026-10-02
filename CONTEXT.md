# EvidenceReady

EvidenceReady turns messy supplier documents into a traceable product dossier so a technical writer can begin authoring. It reports whether that dossier is ready for authoring; it never reports legal compliance.

## Language

### The dossier

**Dossier**:
The fixed set of product facts EvidenceReady collects for one product, together with the provenance of each fact.
_Avoid_: Profile, record, product data

**Dossier Field**:
One named slot in the dossier, such as rated voltage. Its identity, importance and value kind are fixed by the application, never proposed by the model.
_Avoid_: Attribute, property, fact

**Value Kind**:
Whether a field holds a single value, a list of items, or a passage of prose. Decides what disagreement means for that field.
_Avoid_: Type, format

**Essential**:
A field that must be resolved before the dossier can be authoring-ready.
_Avoid_: High-priority; required, mandatory (the latter two imply a legal obligation the product does not assess)

**Supporting**:
A field that enriches the dossier but never blocks readiness.
_Avoid_: Optional, nice-to-have

### Evidence

**Candidate**:
A proposed value for one field, drawn from one source document, before verification and reconciliation.
_Avoid_: Suggestion, extraction, fact

**Citation**:
A candidate's claim about where its value came from — document, page and exact quote. A claim, not yet trusted.
_Avoid_: Reference, source link

**Evidence**:
A citation whose quote was found on the page it names. Only evidence can support a confirmed value.
_Avoid_: Proof, verified citation, source

**Rejected Candidate**:
A candidate whose citation failed verification. Retained and visible, never allowed to support a value.
_Avoid_: Hallucination, bad extraction

**Conflict**:
Two or more candidates giving a scalar field different values after normalization. A candidate may be backed by evidence or asserted by the user, so a person contradicting a document is a conflict like any other.
_Avoid_: Discrepancy, mismatch, inconsistency

**Adjudication**:
A user's choice among conflicting candidates. A documented winner stays confirmed; a value the user supplies stays user-provided. The choice is marked adjudicated, and the losing candidates are retained.
_Avoid_: Resolution, decision

### Field status

**Confirmed**:
The value is supported by evidence.

**User-provided**:
The value came from the user during the interview and no uploaded document supports it.
_Avoid_: Manual, entered

**Unverified**:
A candidate value whose citation failed verification. It can shape a follow-up question but can never satisfy readiness.

**Conflicting**:
The field has an unadjudicated conflict.

**Missing**:
No value is available for the field.

### The agent loop

**Interview**:
The bounded sequence of single questions the planner asks about unresolved fields, ending when essentials are resolved, the user finishes, or the question budget is reached and the user declines to continue.
_Avoid_: Chat, conversation, dialogue

**Proposal**:
A field update the model derives from a user's answer. Never written to the dossier until the user confirms it, and never able to make a value confirmed.
_Avoid_: Suggestion, inference, auto-fill

**Authoring Readiness**:
Whether the dossier can enter a manual-authoring workflow: no essential field missing, no unadjudicated conflict on an essential field, and every essential value either confirmed or user-provided. A supporting field never blocks readiness.
_Avoid_: Compliance, completeness score, validation, pass/fail
