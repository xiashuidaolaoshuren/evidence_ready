import { describe, expect, it } from "vitest";
import { KETTLE_FIELDS, essentialKeys } from "./fields";
import { authoringReadiness, READINESS_VERDICTS } from "./readiness";
import type { DossierField, Evidence } from "./types";

function dossierField(
  key: string,
  overrides: Partial<DossierField> = {},
): DossierField {
  const def = KETTLE_FIELDS.find((field) => field.key === key)!;
  return {
    key: def.key,
    label: def.label,
    group: def.group,
    tier: def.tier,
    valueKind: def.valueKind,
    status: "missing",
    originalValue: null,
    normalizedValue: null,
    markers: [],
    evidence: [],
    rejectedCandidates: [],
    conflictCandidates: [],
    adjudicatedLosers: [],
    resolutionHistory: [],
    ...overrides,
  };
}

function readyDossier(
  essentialOverrides: Partial<Record<string, Partial<DossierField>>> = {},
): DossierField[] {
  return KETTLE_FIELDS.map((def) => {
    const overrides = essentialOverrides[def.key];
    if (overrides) {
      return dossierField(def.key, overrides);
    }
    if (def.tier === "essential") {
      return dossierField(def.key, {
        status: "confirmed",
        originalValue: "value",
        normalizedValue: "value",
      });
    }
    return dossierField(def.key, { status: "missing" });
  });
}

const sampleEvidence: Evidence = {
  documentId: "supplier-spec",
  page: 2,
  quote: "1.5 L",
  surroundingWindow: "...Capacity: 1.5 L...",
};

describe("authoringReadiness ready", () => {
  it("returns ready when all essential fields are confirmed", () => {
    const result = authoringReadiness(readyDossier());
    expect(result.verdict).toBe("ready");
    expect(result.blockers).toEqual([]);
  });

  it("returns ready when essentials are confirmed or user-provided", () => {
    const dossier = readyDossier({
      "importer-contact": {
        status: "user-provided",
        originalValue: "Acme Imports GmbH",
        normalizedValue: "Acme Imports GmbH",
      },
      "rated-power": {
        status: "user-provided",
        originalValue: "1850 W",
        normalizedValue: "1850 W",
      },
    });

    const result = authoringReadiness(dossier);
    expect(result.verdict).toBe("ready");
    expect(result.blockers).toEqual([]);
  });
});

describe("authoringReadiness needs-review", () => {
  it("blocks on missing, declared-unavailable, unverified, and unadjudicated conflict essentials", () => {
    expect(
      authoringReadiness(
        readyDossier({
          "importer-contact": { status: "missing" },
        }),
      ).verdict,
    ).toBe("needs-review");

    expect(
      authoringReadiness(
        readyDossier({
          "importer-contact": {
            status: "missing",
            markers: ["declaredUnavailable"],
          },
        }),
      ).verdict,
    ).toBe("needs-review");

    expect(
      authoringReadiness(
        readyDossier({
          "rated-power": {
            status: "unverified",
            originalValue: "2200 W",
            normalizedValue: "2200 W",
          },
        }),
      ).verdict,
    ).toBe("needs-review");

    expect(
      authoringReadiness(
        readyDossier({
          capacity: {
            status: "conflicting",
            originalValue: ["1.5 L", "1.7 L"],
            normalizedValue: ["1.5 L", "1.7 L"],
            evidence: [sampleEvidence],
          },
        }),
      ).verdict,
    ).toBe("needs-review");
  });

  it("does not block on supporting missing, unverified, or conflict fields", () => {
    const dossier = readyDossier({
      "primary-materials": { status: "missing" },
      "automatic-shutoff": {
        status: "unverified",
        originalValue: "yes",
        normalizedValue: "yes",
      },
      "included-components": {
        status: "conflicting",
        originalValue: ["a", "b"],
        normalizedValue: ["a", "b"],
      },
    });

    const result = authoringReadiness(dossier);
    expect(result.verdict).toBe("ready");
    expect(result.blockers).toEqual([]);
  });

  it("lists each blocking essential with its reason", () => {
    const dossier = readyDossier({
      "importer-contact": { status: "missing" },
      "rated-power": {
        status: "unverified",
        originalValue: "2200 W",
        normalizedValue: "2200 W",
      },
      capacity: {
        status: "conflicting",
        originalValue: ["1.5 L", "1.7 L"],
        normalizedValue: ["1.5 L", "1.7 L"],
        evidence: [sampleEvidence],
      },
    });

    const result = authoringReadiness(dossier);
    expect(result.verdict).toBe("needs-review");
    expect(result.blockers).toEqual([
      { fieldKey: "importer-contact", reason: "missing" },
      { fieldKey: "rated-power", reason: "unverified" },
      { fieldKey: "capacity", reason: "conflict" },
    ]);
  });
});

describe("READINESS_VERDICTS", () => {
  it("exports the stable readiness verdict enum", () => {
    expect(READINESS_VERDICTS).toEqual(["ready", "needs-review"]);
    expect(essentialKeys()).toHaveLength(9);
  });
});
