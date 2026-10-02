import { describe, expect, it } from "vitest";
import { KETTLE_FIELDS } from "./fields";
import { nextQuestion, shouldPause, SOFT_CAP } from "./planner";
import type { DossierField, FieldStatus, InterviewState } from "./types";

function emptyState(overrides: Partial<InterviewState> = {}): InterviewState {
  return {
    phase: "interview",
    currentQuestionFieldKey: null,
    askedFieldKeys: [],
    answeredFieldKeys: [],
    declaredUnavailableFieldKeys: [],
    questionCount: 0,
    continuePastBudget: false,
    completionReason: null,
    ...overrides,
  };
}

function dossierField(
  key: string,
  status: FieldStatus,
  tierOverride?: DossierField["tier"],
): DossierField {
  const def = KETTLE_FIELDS.find((field) => field.key === key)!;
  return {
    key: def.key,
    label: def.label,
    group: def.group,
    tier: tierOverride ?? def.tier,
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

function dossierWithStatuses(
  entries: Array<[string, FieldStatus] | [string, FieldStatus, DossierField["tier"]]>,
): DossierField[] {
  const byKey = new Map(
    entries.map((entry) => {
      const [key, status, tier] = entry;
      return [key, dossierField(key, status, tier)];
    }),
  );
  return KETTLE_FIELDS.map((def) => byKey.get(def.key) ?? dossierField(def.key, "confirmed"));
}

describe("nextQuestion ranking", () => {
  it("ranks essential conflict above essential missing above essential unverified", () => {
    const dossier = dossierWithStatuses([
      ["capacity", "conflicting"],
      ["importer-contact", "missing"],
      ["rated-power", "unverified"],
    ]);

    expect(nextQuestion(dossier, emptyState())).toEqual({
      fieldKey: "capacity",
      shape: "conflict",
    });
  });

  it("ranks essential before supporting when both are unresolved", () => {
    const dossier = dossierWithStatuses([
      ["primary-materials", "missing", "supporting"],
      ["rated-power", "unverified"],
    ]);

    expect(nextQuestion(dossier, emptyState())).toEqual({
      fieldKey: "rated-power",
      shape: "unverified",
    });
  });

  it("uses declaration order as the final tie-break within the same tier and state", () => {
    const dossier = dossierWithStatuses([
      ["capacity", "missing"],
      ["importer-contact", "missing"],
    ]);

    expect(nextQuestion(dossier, emptyState())).toEqual({
      fieldKey: "importer-contact",
      shape: "missing",
    });
  });

  it("returns null when no essential field is unresolved", () => {
    const dossier = dossierWithStatuses([
      ["primary-materials", "missing", "supporting"],
      ["included-components", "unverified", "supporting"],
    ]);

    expect(nextQuestion(dossier, emptyState())).toBeNull();
  });

  it("returns a supporting question after essentials clear when continueSupporting is set", () => {
    const dossier = dossierWithStatuses([
      ["primary-materials", "missing", "supporting"],
      ["included-components", "unverified", "supporting"],
    ]);

    expect(
      nextQuestion(
        dossier,
        emptyState({ essentialsClear: true, continueSupporting: true }),
      ),
    ).toEqual({
      fieldKey: "primary-materials",
      shape: "missing",
    });
  });

  it("does not revisit an essential blocker left unresolved", () => {
    const dossier = dossierWithStatuses([
      ["capacity", "conflicting"],
      ["importer-contact", "missing"],
    ]);

    expect(
      nextQuestion(
        dossier,
        emptyState({ askedFieldKeys: ["capacity"], exhaustedFieldKeys: ["capacity"] }),
      ),
    ).toEqual({
      fieldKey: "importer-contact",
      shape: "missing",
    });
  });

  it("pauses before presenting the sixth question", () => {
    const dossier = dossierWithStatuses([
      ["importer-contact", "missing"],
      ["rated-power", "unverified"],
    ]);

    expect(
      shouldPause(
        emptyState({
          questionCount: 5,
          pausedForBudget: false,
        }),
      ),
    ).toBe(true);
    expect(
      nextQuestion(
        dossier,
        emptyState({
          questionCount: 5,
          pausedForBudget: true,
          askedFieldKeys: [
            "capacity",
            "importer-contact",
            "rated-power",
            "rated-voltage",
            "rated-frequency",
          ],
        }),
      ),
    ).toBeNull();
  });

  it("returns null when every unresolved essential has already been asked", () => {
    const dossier = dossierWithStatuses([
      ["capacity", "conflicting"],
      ["importer-contact", "missing"],
      ["rated-power", "unverified"],
    ]);

    expect(
      nextQuestion(
        dossier,
        emptyState({ askedFieldKeys: ["capacity"] }),
      ),
    ).toEqual({
      fieldKey: "importer-contact",
      shape: "missing",
    });
  });

  it("returns null when every unresolved essential has already been asked", () => {
    const dossier = dossierWithStatuses([
      ["capacity", "conflicting"],
      ["importer-contact", "missing"],
      ["rated-power", "unverified"],
    ]);

    expect(
      nextQuestion(
        dossier,
        emptyState({
          askedFieldKeys: ["capacity", "importer-contact", "rated-power"],
        }),
      ),
    ).toBeNull();
  });
});

describe("shouldPause", () => {
  it("pauses at the soft cap when the user has not continued past budget", () => {
    expect(SOFT_CAP).toBe(5);
    expect(shouldPause(emptyState({ questionCount: 5 }))).toBe(true);
    expect(shouldPause(emptyState({ questionCount: 4 }))).toBe(false);
  });

  it("does not pause once continuePastBudget is set", () => {
    expect(
      shouldPause(
        emptyState({ questionCount: 5, continuePastBudget: true }),
      ),
    ).toBe(false);
  });
});

describe("nextQuestion shape", () => {
  it("derives conflict, missing, and unverified shapes from dossier status", () => {
    expect(
      nextQuestion(
        dossierWithStatuses([["capacity", "conflicting"]]),
        emptyState(),
      )?.shape,
    ).toBe("conflict");
    expect(
      nextQuestion(
        dossierWithStatuses([["importer-contact", "missing"]]),
        emptyState(),
      )?.shape,
    ).toBe("missing");
    expect(
      nextQuestion(
        dossierWithStatuses([["rated-power", "unverified"]]),
        emptyState(),
      )?.shape,
    ).toBe("unverified");
  });
});
