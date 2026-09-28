import { beforeEach, describe, expect, it } from "vitest";
import { loadSession, saveSession, clearSession } from "./session";
import type { DossierField, InterviewState } from "./domain/types";

const store = new Map<string, string>();

beforeEach(() => {
  store.clear();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
    },
  });
  clearSession();
});

function sampleDossier(): DossierField[] {
  return [
    {
      key: "capacity",
      label: "Capacity",
      group: "Electrical and Physical Information",
      tier: "essential",
      valueKind: "scalar",
      status: "conflicting",
      originalValue: ["1.5 L", "1.7 L"],
      normalizedValue: ["1.5 L", "1.7 L"],
      markers: [],
      evidence: [],
      rejectedCandidates: [],
      conflictCandidates: [
        {
          value: "1.5 L",
          normalizedValue: "1.5 L",
          citation: { documentId: "spec", page: 1, quote: "1.5 L" },
          source: "document",
        },
        {
          value: "1.7 L",
          normalizedValue: "1.7 L",
          citation: { documentId: "manual", page: 2, quote: "1.7 L" },
          source: "document",
        },
      ],
      adjudicatedLosers: [],
      resolutionHistory: [],
    },
  ];
}

function sampleInterview(): InterviewState {
  return {
    phase: "interview",
    currentQuestionFieldKey: "capacity",
    askedFieldKeys: ["capacity"],
    answeredFieldKeys: [],
    declaredUnavailableFieldKeys: [],
    questionCount: 1,
    continuePastBudget: false,
    completionReason: null,
  };
}

describe("loadSession", () => {
  it("returns null when storage is empty", () => {
    expect(loadSession()).toBeNull();
  });
});

describe("saveSession", () => {
  it("round-trips dossier, mode, and interview", () => {
    const session = {
      dossier: sampleDossier(),
      rejected: [],
      mode: "recorded" as const,
      interview: sampleInterview(),
      excerpts: [{ documentId: "spec", page: 1, quote: "1.5 L", surroundingWindow: "Capacity: 1.5 L" }],
    };

    saveSession(session);

    expect(loadSession()).toEqual(session);
  });

  it("falls back to in-memory and warns when quota is exceeded", () => {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: () => null,
        setItem: () => {
          const error = new Error("The quota has been exceeded.");
          error.name = "QuotaExceededError";
          throw error;
        },
        removeItem: () => {},
      },
    });

    const session = {
      dossier: sampleDossier(),
      rejected: [],
      mode: "recorded" as const,
      interview: sampleInterview(),
      excerpts: [],
    };

    const result = saveSession(session);

    expect(result.warned).toBe(true);
    expect(loadSession()).toEqual(session);
  });
});
