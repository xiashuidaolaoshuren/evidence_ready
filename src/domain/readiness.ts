import { essentialKeys } from "./fields";
import type { DossierField } from "./types";

export const READINESS_VERDICTS = ["ready", "needs-review"] as const;

export type ReadinessVerdict = (typeof READINESS_VERDICTS)[number];

export type BlockerReason = "missing" | "conflict" | "unverified";

export interface ReadinessBlocker {
  fieldKey: string;
  reason: BlockerReason;
}

export interface ReadinessResult {
  verdict: ReadinessVerdict;
  blockers: ReadinessBlocker[];
}

function blockerForField(field: DossierField): ReadinessBlocker | null {
  if (field.status === "missing") {
    return { fieldKey: field.key, reason: "missing" };
  }
  if (field.status === "conflicting") {
    return { fieldKey: field.key, reason: "conflict" };
  }
  if (field.status === "unverified") {
    return { fieldKey: field.key, reason: "unverified" };
  }
  return null;
}

export function authoringReadiness(dossier: DossierField[]): ReadinessResult {
  const essential = new Set(essentialKeys());
  const blockers: ReadinessBlocker[] = [];

  for (const field of dossier) {
    if (!essential.has(field.key)) continue;
    const blocker = blockerForField(field);
    if (blocker) blockers.push(blocker);
  }

  const order = essentialKeys();
  blockers.sort(
    (a, b) => order.indexOf(a.fieldKey) - order.indexOf(b.fieldKey),
  );

  return {
    verdict: blockers.length === 0 ? "ready" : "needs-review",
    blockers,
  };
}
