import { describe, expect, it } from "vitest";
import { KETTLE_FIELDS, essentialKeys } from "./fields";
import type { DossierField, FieldStatus, ProvenanceMarker } from "./types";
import { ESSENTIAL_COVERAGE_THRESHOLD, assessCoverage } from "./coverage";

function dossier(
  statuses: Partial<Record<string, FieldStatus>> = {},
  markers: Partial<Record<string, ProvenanceMarker[]>> = {},
): DossierField[] {
  return KETTLE_FIELDS.map((def) => ({
    key: def.key,
    label: def.label,
    group: def.group,
    tier: def.tier,
    valueKind: def.valueKind,
    status: statuses[def.key] ?? "missing",
    originalValue: null,
    normalizedValue: null,
    markers: markers[def.key] ?? [],
    evidence: [],
    rejectedCandidates: [],
    conflictCandidates: [],
    adjudicatedLosers: [],
    resolutionHistory: [],
  }));
}

function statusMap(
  keys: string[],
  status: FieldStatus,
): Partial<Record<string, FieldStatus>> {
  return Object.fromEntries(keys.map((key) => [key, status]));
}

describe("ESSENTIAL_COVERAGE_THRESHOLD", () => {
  it("is the declared constant 0.5", () => {
    expect(ESSENTIAL_COVERAGE_THRESHOLD).toBe(0.5);
  });
});

describe("assessCoverage", () => {
  const essentials = essentialKeys();

  it("returns interview when at least half of essential fields are non-missing", () => {
    const present = essentials.slice(0, 5);
    expect(assessCoverage(dossier(statusMap(present, "confirmed")))).toBe(
      "interview",
    );
  });

  it("returns insufficient when fewer than half of essential fields are non-missing", () => {
    const present = essentials.slice(0, 4);
    expect(assessCoverage(dossier(statusMap(present, "confirmed")))).toBe(
      "insufficient",
    );
  });

  it("counts confirmed, conflicting, unverified, and user-provided as having a candidate", () => {
    const present = {
      [essentials[0]!]: "confirmed",
      [essentials[1]!]: "conflicting",
      [essentials[2]!]: "unverified",
      [essentials[3]!]: "user-provided",
      [essentials[4]!]: "confirmed",
    } as const;
    expect(assessCoverage(dossier(present))).toBe("interview");
  });

  it("does not count a declared-unavailable field toward coverage because status is still missing", () => {
    const present = statusMap(essentials.slice(0, 4), "confirmed");
    const unavailableKey = essentials[4]!;
    expect(
      assessCoverage(
        dossier(present, { [unavailableKey]: ["declaredUnavailable"] }),
      ),
    ).toBe("insufficient");
  });

  it("ignores supporting fields when computing the fraction", () => {
    const supportingKeys = KETTLE_FIELDS.filter(
      (field) => field.tier === "supporting",
    ).map((field) => field.key);
    const statuses = {
      ...statusMap(essentials.slice(0, 4), "confirmed"),
      ...statusMap(supportingKeys, "confirmed"),
    };
    expect(assessCoverage(dossier(statuses))).toBe("insufficient");
  });
});
