import { essentialKeys } from "./fields";
import type { DossierField } from "./types";

export const ESSENTIAL_COVERAGE_THRESHOLD = 0.5;

export function assessCoverage(
  dossier: DossierField[],
): "interview" | "insufficient" {
  const keys = essentialKeys();
  const byKey = new Map(dossier.map((field) => [field.key, field]));
  const present = keys.filter((key) => {
    const field = byKey.get(key);
    return field !== undefined && field.status !== "missing";
  }).length;
  const fraction = present / keys.length;
  return fraction >= ESSENTIAL_COVERAGE_THRESHOLD ? "interview" : "insufficient";
}
