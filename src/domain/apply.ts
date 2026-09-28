import { KETTLE_FIELDS } from "./fields.js";
import { normalizeValue } from "./normalize.js";
import type { ConflictCandidate, DossierField, Evidence, Proposal, ResolutionEvent } from "./types.js";

export type ApplyEvent =
  | {
      type: "provide-answer";
      fieldKey: string;
      value: unknown;
      sourceDescription?: string;
    }
  | { type: "declare-unavailable"; fieldKey: string }
  | { type: "adjudicate"; fieldKey: string; selectedValue: unknown }
  | { type: "apply-proposals"; proposals: Proposal[] };

export interface ApplyResult {
  dossier: DossierField[];
}

function fieldDefinition(fieldKey: string) {
  const def = KETTLE_FIELDS.find((field) => field.key === fieldKey);
  if (!def) return null;
  return def;
}

function resolutionEvent(action: string, detail?: string): ResolutionEvent {
  return {
    at: new Date().toISOString(),
    action,
    detail,
  };
}

function updateField(
  dossier: DossierField[],
  fieldKey: string,
  updater: (field: DossierField) => DossierField,
): DossierField[] {
  return dossier.map((field) => (field.key === fieldKey ? updater(field) : field));
}

function normalizedEquals(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function applyProvideAnswer(
  dossier: DossierField[],
  fieldKey: string,
  value: unknown,
  sourceDescription?: string,
): DossierField[] {
  const def = fieldDefinition(fieldKey);
  if (!def) return dossier;

  return updateField(dossier, fieldKey, (field) => {
    const normalized = normalizeValue(value, def.valueKind);

    if (field.status === "confirmed") {
      return {
        ...field,
        status: "conflicting",
        originalValue: [field.originalValue, value],
        normalizedValue: [field.normalizedValue, normalized],
        conflictCandidates: [
          {
            value: field.originalValue,
            normalizedValue: field.normalizedValue,
            citation: field.evidence[0],
            source: "document",
          },
          {
            value,
            normalizedValue: normalized,
            source: "user",
          },
        ],
        resolutionHistory: [
          ...field.resolutionHistory,
          resolutionEvent("user-conflict", String(value)),
        ],
      };
    }

    if (field.status === "conflicting") {
      const originalValues = Array.isArray(field.originalValue)
        ? field.originalValue
        : [field.originalValue];
      const normalizedValues = Array.isArray(field.normalizedValue)
        ? field.normalizedValue
        : [field.normalizedValue];
      const alreadyPresent = normalizedValues.some((existing) =>
        normalizedEquals(existing, normalized),
      );
      if (alreadyPresent) return field;

      return {
        ...field,
        status: "conflicting",
        originalValue: [...originalValues, value],
        normalizedValue: [...normalizedValues, normalized],
        conflictCandidates: [
          ...field.conflictCandidates,
          { value, normalizedValue: normalized, source: "user" },
        ],
        resolutionHistory: [
          ...field.resolutionHistory,
          resolutionEvent("user-conflict", String(value)),
        ],
      };
    }

    return {
      ...field,
      status: "user-provided",
      originalValue: value,
      normalizedValue: normalized,
      evidence: [],
      conflictCandidates: [],
      adjudicatedLosers: [],
      userSourceDescription: sourceDescription?.trim() || field.userSourceDescription || null,
      resolutionHistory: [
        ...field.resolutionHistory,
        resolutionEvent("user-provided", String(value)),
      ],
    };
  });
}

function applyDeclareUnavailable(
  dossier: DossierField[],
  fieldKey: string,
): DossierField[] {
  if (!fieldDefinition(fieldKey)) return dossier;

  return updateField(dossier, fieldKey, (field) => ({
    ...field,
    status: "missing",
    originalValue: null,
    normalizedValue: null,
    evidence: [],
    conflictCandidates: [],
    adjudicatedLosers: [],
    markers: field.markers.includes("declaredUnavailable")
      ? field.markers
      : [...field.markers, "declaredUnavailable"],
    resolutionHistory: [
      ...field.resolutionHistory,
      resolutionEvent("declared-unavailable"),
    ],
  }));
}

function winnerEvidence(winner: ConflictCandidate): Evidence[] {
  if (winner.source !== "document" || !winner.citation) return [];
  const citation = winner.citation;
  if ("surroundingWindow" in citation) {
    return [citation as Evidence];
  }
  return [{ ...citation, surroundingWindow: "" }];
}

function applyAdjudicate(
  dossier: DossierField[],
  fieldKey: string,
  selectedValue: unknown,
): DossierField[] {
  const def = fieldDefinition(fieldKey);
  if (!def) return dossier;

  return updateField(dossier, fieldKey, (field) => {
    if (field.status !== "conflicting") return field;

    const selectedNormalized = normalizeValue(selectedValue, def.valueKind);
    const trimmedSelected = String(selectedValue).trim();
    if (trimmedSelected.length === 0) return field;

    const winner = field.conflictCandidates.find((candidate) =>
      normalizedEquals(candidate.normalizedValue, selectedNormalized),
    ) ?? {
      value: selectedValue,
      normalizedValue: selectedNormalized,
      source: "user" as const,
    };

    const losers = field.conflictCandidates.filter(
      (candidate) => !normalizedEquals(candidate.normalizedValue, selectedNormalized),
    );

    return {
      ...field,
      status: winner.source === "document" ? "confirmed" : "user-provided",
      originalValue: winner.value,
      normalizedValue: winner.normalizedValue,
      markers: field.markers.includes("adjudicated")
        ? field.markers
        : [...field.markers, "adjudicated"],
      evidence: winnerEvidence(winner),
      conflictCandidates: [],
      adjudicatedLosers: losers,
      resolutionHistory: [
        ...field.resolutionHistory,
        resolutionEvent(
          "adjudicated",
          losers.map((loser) => String(loser.value)).join(", ") || undefined,
        ),
      ],
    };
  });
}

export function parseAnswer(fieldKey: string, answerText: string): ApplyEvent {
  const trimmed = answerText.trim();
  if (trimmed.length === 0) {
    return { type: "declare-unavailable", fieldKey };
  }
  return { type: "provide-answer", fieldKey, value: trimmed };
}

export function needsInterpretation(fieldKey: string, answerText: string): boolean {
  const trimmed = answerText.trim();
  if (trimmed.length === 0) return false;

  if (/[—–]|(?:\s-\s)/.test(trimmed)) return true;

  const lower = trimmed.toLowerCase();
  for (const field of KETTLE_FIELDS) {
    if (field.key === fieldKey) continue;
    if (lower.includes(field.label.toLowerCase())) return true;
    const keyPhrase = field.key.replace(/-/g, " ");
    if (keyPhrase.length > 4 && lower.includes(keyPhrase)) return true;
  }

  return false;
}

export function applyEvent(
  dossier: DossierField[],
  event: ApplyEvent,
): ApplyResult {
  const copy = structuredClone(dossier);

  if (event.type === "provide-answer") {
    return {
      dossier: applyProvideAnswer(
        copy,
        event.fieldKey,
        event.value,
        event.sourceDescription,
      ),
    };
  }

  if (event.type === "declare-unavailable") {
    return { dossier: applyDeclareUnavailable(copy, event.fieldKey) };
  }

  if (event.type === "adjudicate") {
    return {
      dossier: applyAdjudicate(copy, event.fieldKey, event.selectedValue),
    };
  }

  let next = copy;
  for (const proposal of event.proposals) {
    if (!fieldDefinition(proposal.fieldKey)) continue;
    next = applyProvideAnswer(
      next,
      proposal.fieldKey,
      proposal.proposedValue,
    );
  }
  return { dossier: next };
}
