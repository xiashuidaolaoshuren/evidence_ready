import type { FieldDefinition } from "./fields";
import { normalizeValue } from "./normalize";
import type {
  Candidate,
  ConflictCandidate,
  DossierField,
  Evidence,
  RejectedCandidate,
} from "./types";

export type VerifiedCandidate = Candidate & { citation: Evidence };

export interface ReconcileInput {
  evidence: VerifiedCandidate[];
  rejected: RejectedCandidate[];
  fields: readonly FieldDefinition[];
}

function emptyField(
  def: FieldDefinition,
  status: DossierField["status"] = "missing",
): DossierField {
  return {
    key: def.key,
    label: def.label,
    group: def.group,
    tier: def.tier,
    valueKind: def.valueKind,
    status,
    originalValue: null,
    normalizedValue: null,
    markers: [],
    evidence: [],
    rejectedCandidates: [],
    conflictCandidates: [],
    adjudicatedLosers: [],
    resolutionHistory: [],
  };
}

function groupByFieldKey<T extends { fieldKey: string }>(
  items: T[],
): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const item of items) {
    const list = grouped.get(item.fieldKey) ?? [];
    list.push(item);
    grouped.set(item.fieldKey, list);
  }
  return grouped;
}

function collectListItems(verified: VerifiedCandidate[]): unknown[] {
  const items: unknown[] = [];
  for (const item of verified) {
    if (Array.isArray(item.value)) {
      items.push(...item.value);
    } else if (item.value != null) {
      items.push(item.value);
    }
  }
  return items;
}

function scalarIdentity(value: unknown): string {
  if (typeof value === "string") return value.toLowerCase();
  return JSON.stringify(value);
}

function reconcileScalar(
  def: FieldDefinition,
  verified: VerifiedCandidate[],
): DossierField {
  const normalized = verified.map((item) =>
    normalizeValue(item.value, "scalar"),
  );
  const unique = new Set(normalized.map((value) => scalarIdentity(value)));
  const evidence = verified.map((item) => item.citation);

  if (unique.size === 1) {
    return {
      ...emptyField(def, "confirmed"),
      originalValue: verified[0]!.value,
      normalizedValue: normalized[0],
      evidence,
    };
  }

  const conflictCandidates: ConflictCandidate[] = verified.map((item, index) => ({
    value: item.value,
    normalizedValue: normalized[index],
    citation: item.citation,
    source: "document",
  }));

  return {
    ...emptyField(def, "conflicting"),
    originalValue: verified.map((item) => item.value),
    normalizedValue: normalized,
    evidence,
    conflictCandidates,
  };
}

function reconcileList(
  def: FieldDefinition,
  verified: VerifiedCandidate[],
): DossierField {
  const items = collectListItems(verified);
  return {
    ...emptyField(def, "confirmed"),
    originalValue: items,
    normalizedValue: normalizeValue(items, "list"),
    evidence: verified.map((item) => item.citation),
  };
}

function reconcileProse(
  def: FieldDefinition,
  verified: VerifiedCandidate[],
): DossierField {
  const first = verified[0]!;
  return {
    ...emptyField(def, "confirmed"),
    originalValue: first.value,
    normalizedValue: normalizeValue(first.value, "prose"),
    evidence: verified.map((item) => item.citation),
  };
}

function reconcileUnverified(
  def: FieldDefinition,
  rejected: RejectedCandidate[],
): DossierField {
  const first = rejected[0]!;
  return {
    ...emptyField(def, "unverified"),
    originalValue: first.value,
    normalizedValue: normalizeValue(first.value, def.valueKind),
    rejectedCandidates: rejected,
  };
}

export function reconcileCandidates({
  evidence,
  rejected,
  fields,
}: ReconcileInput): DossierField[] {
  const verifiedByField = groupByFieldKey(evidence);
  const rejectedByField = groupByFieldKey(rejected);

  return fields.map((def) => {
    const verified = verifiedByField.get(def.key) ?? [];
    const rejectedForField = rejectedByField.get(def.key) ?? [];

    if (verified.length > 0) {
      const field =
        def.valueKind === "scalar"
          ? reconcileScalar(def, verified)
          : def.valueKind === "list"
            ? reconcileList(def, verified)
            : reconcileProse(def, verified);
      return rejectedForField.length > 0
        ? { ...field, rejectedCandidates: rejectedForField }
        : field;
    }

    if (rejectedForField.length > 0) {
      return reconcileUnverified(def, rejectedForField);
    }

    return emptyField(def);
  });
}
