# EvidenceReady

EvidenceReady turns messy supplier documents into a traceable product dossier so a technical writer can begin authoring. It reports whether that dossier is ready for authoring; it never reports legal compliance.

## Language

### The dossier

**Dossier**:
The fixed set of product facts EvidenceReady collects for one product model, together with the provenance of each fact.
_Avoid_: Profile, record, product data

**Blueprint**:
The category-specific definition of a dossier's fields: identity, importance, question, value kind, applicability, and how multiple values combine. The application fixes it; the model never proposes fields.
_Avoid_: Schema, template, profile

**Product Category**:
The kind of product a blueprint covers. The user selects one category for a dossier.
_Avoid_: Product type, vertical

**Product Model**:
The single model a dossier describes. A source may contribute model-specific facts only when its connection to that model is established.
_Avoid_: Variant, SKU, product line

**Dossier Field**:
One named slot in the dossier, such as rated voltage. Its identity, importance and value kind come from the selected blueprint, never from the model.
_Avoid_: Attribute, property, fact

**Value Kind**:
Whether a field holds a single value, a list of items, or a passage of prose. Decides what disagreement means for that field.
_Avoid_: Type, format

**Additive List**:
A list whose supported items accumulate across sources.
_Avoid_: Complete list, sequence

**Complete Account**:
A list or sequence kept intact. A different complete account is a differing account, not material to merge.
_Avoid_: Bag, set

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
A candidate's claim about where its value came from: the document, page, and passages it relies on. A claim, not yet trusted.
_Avoid_: Reference, source link

**Support**:
The relationship in which cited passages, read with the qualifications on their page, establish every claim in a value. Page context may disqualify a passage; it cannot add an uncited claim.
_Avoid_: Mention, quote match, relevance

**Evidence**:
A citation whose passages were found on the named page and that support the entire value. Only evidence can support a confirmed value.
_Avoid_: Proof, verified citation, source

**Partial Support**:
A candidate whose passages establish only some of its claims. The original candidate stays unverified; a narrower value is a separate candidate.
_Avoid_: Trimmed value, best-effort confirmation

**Rejected Candidate**:
A candidate whose citation failed verification. Retained and visible, never allowed to support a value.
_Avoid_: Hallucination, bad extraction

**Conflict**:
Two or more candidates giving a scalar field different values after normalization. A candidate may be backed by evidence or asserted by the user, so a person contradicting a document is a conflict like any other.
_Avoid_: Discrepancy, mismatch, inconsistency

**Differing Accounts**:
Distinct prose values, or distinct complete accounts, for one field after basic normalization. They require review and are not yet a judgment that the accounts contradict.
_Avoid_: Conflict, discrepancy

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
No value is available for the field. Silence in a document is missing, not a negative answer and not non-applicability.

**Not Applicable**:
The field needs no value because a blueprint-defined condition is unmet. The condition rests on a document-supported or user-confirmed prerequisite, never on silence.
_Avoid_: Missing, absent, skipped, N/A

### Sources

**Category-neutral Source**:
A document that names no product category but can support shared facts about this product model or its responsible party.
_Avoid_: Generic document, irrelevant upload

**Flagged Source**:
A document whose category compatibility, or whose connection to the product model, has not been accepted.
_Avoid_: Rejected document, bad upload

**Source Review**:
The user's decision to exclude a flagged source or accept it for extraction. Acceptance permits use; it does not confirm extracted values.
_Avoid_: Classification, approval of facts

### The agent loop

**Interview**:
The bounded sequence of single questions the planner asks about unresolved fields, ending when essentials are resolved, the user finishes, or the question budget is reached and the user declines to continue.
_Avoid_: Chat, conversation, dialogue

**Proposal**:
A field update the model derives from a user's answer. Never written to the dossier until the user confirms it, and never able to make a value confirmed.
_Avoid_: Suggestion, inference, auto-fill

**Authoring Readiness**:
Whether the dossier can enter a manual-authoring workflow: no essential field missing or unverified, no unadjudicated conflict or differing accounts on an essential field, every applicable essential value either confirmed or user-provided, and no flagged source awaiting review. A not-applicable field needs no value. A supporting field, including a supporting disagreement, never blocks readiness.
_Avoid_: Compliance, completeness score, validation, pass/fail
