---
status: accepted
date: 2026-08-28
revised: 2026-08-29
---

# Keep Gemini inside a deterministic control plane

Pergamon’s public claim is “structure first, controlled AI second.” A free-form chatbot would contradict that and make the live interview harder to defend. Gemini may extract candidate values from source text and interpret a free-text answer into proposals. It may not phrase questions, invent dossier fields, confirm unsupported citations, auto-resolve conflicts, write to the dossier without explicit user confirmation, or decide readiness.

## Considered Options

- **Deterministic planner + verified extraction (chosen).** Fixed 15-field schema, Zod validation, exact-quote verification, normalization, a ranked question policy, and a five-question budget after which the planner pauses rather than stops. Gemini fills structured slots; TypeScript owns state transitions.
- **Give Gemini more planning autonomy.** Faster to prototype, weaker provenance, harder to explain when the model skips a conflict or invents a requirement.
- **No live model.** Safest to run, but fails the “agentic experience” brief unless the whole demo is a fixture playback.

## Consequences

Readiness is derived from dossier status, not model prose. Unsupported quotes are rejected even if the extracted value looks plausible. The bundled fixture must demonstrate citation rejection without depending on a live Gemini mistake. Stack: React and Vite with Tailwind CSS v4 and shadcn/ui for the interface, a same-repo TypeScript server for document and Gemini operations, server-only Gemini key, session state in the browser, no database.

## Revision, 2026-08-28

This ADR originally also allowed Gemini to “phrase an approved question.” That is withdrawn. The gain is cosmetic, it adds a round trip to every question during a live demo, and a model improvising around field metadata is one adjective away from implying that a prototype field is legally required — which ADR 0003 forbids outright. Question wording now comes from the field table.

In exchange, answer interpretation is broader than first described: one free-text answer may produce proposals across several fields, so a product manager who volunteers a correction alongside the answer is not ignored. The control is that a proposal remains a proposal — the user confirms it, TypeScript writes it, and it can never produce a confirmed value.

The model-supplied confidence score is also removed. Verification already answers the question confidence pretends to answer, and far more credibly; keeping a self-reported number would have left the only unverifiable input in a system whose entire subject is verifiability.

## Revision, 2026-08-29

The interface stack is React and Vite with Tailwind CSS v4 and shadcn/ui, not Next.js App Router. Document parsing and Gemini calls remain on a same-repo TypeScript server so the API key never reaches the browser. The control plane is unchanged: TypeScript still owns verification, planning, confirmation, and readiness.

## Later narrowing

ADR 0007 narrows the rule that confirmation is only a deterministic quote-presence check. A bounded semantic check may decide that located passages support a value. The model still may not invent fields, phrase questions, auto-resolve disagreements, or decide readiness.
