import { KETTLE_FIELDS } from "./fields";
import type { DossierField, FieldStatus, InterviewState } from "./types";

export const SOFT_CAP = 5;

export type QuestionShape = "conflict" | "missing" | "unverified";

export interface Question {
  fieldKey: string;
  shape: QuestionShape;
}

const UNRESOLVED_STATUSES: FieldStatus[] = [
  "conflicting",
  "missing",
  "unverified",
];

const STATUS_PRIORITY: Record<FieldStatus, number> = {
  conflicting: 0,
  missing: 1,
  unverified: 2,
  confirmed: 3,
  "user-provided": 4,
};

const TIER_PRIORITY = {
  essential: 0,
  supporting: 1,
} as const;

function declarationIndex(fieldKey: string): number {
  return KETTLE_FIELDS.findIndex((field) => field.key === fieldKey);
}

function shapeForStatus(status: FieldStatus): QuestionShape {
  if (status === "conflicting") return "conflict";
  if (status === "missing") return "missing";
  return "unverified";
}

function compareUnresolved(a: DossierField, b: DossierField): number {
  const tierDiff = TIER_PRIORITY[a.tier] - TIER_PRIORITY[b.tier];
  if (tierDiff !== 0) return tierDiff;

  const statusDiff = STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status];
  if (statusDiff !== 0) return statusDiff;

  return declarationIndex(a.key) - declarationIndex(b.key);
}

function rankUnresolved(dossier: DossierField[]): DossierField[] {
  return dossier
    .filter((field) => UNRESOLVED_STATUSES.includes(field.status))
    .sort(compareUnresolved);
}

function isExhausted(fieldKey: string, state: InterviewState): boolean {
  return (
    state.exhaustedFieldKeys?.includes(fieldKey) === true ||
    state.askedFieldKeys.includes(fieldKey)
  );
}

function questionFor(field: DossierField): Question {
  return {
    fieldKey: field.key,
    shape: shapeForStatus(field.status),
  };
}

export function nextQuestion(
  dossier: DossierField[],
  state: InterviewState,
): Question | null {
  if (state.pausedForBudget && !state.continuePastBudget) {
    return null;
  }

  const ranked = rankUnresolved(dossier);
  const unresolvedEssentials = ranked.filter((field) => field.tier === "essential");
  const unresolvedSupporting = ranked.filter((field) => field.tier === "supporting");

  if (unresolvedEssentials.length > 0) {
    const unasked = unresolvedEssentials.filter(
      (field) => !isExhausted(field.key, state),
    );
    if (unasked[0]) {
      return questionFor(unasked[0]);
    }
  }

  if (unresolvedSupporting.length === 0) {
    return null;
  }

  if (!state.continueSupporting) {
    return null;
  }

  const unaskedSupporting = unresolvedSupporting.filter(
    (field) => !isExhausted(field.key, state),
  );
  return unaskedSupporting[0] ? questionFor(unaskedSupporting[0]) : null;
}

export function shouldPause(state: InterviewState): boolean {
  return state.questionCount >= SOFT_CAP && !state.continuePastBudget;
}
