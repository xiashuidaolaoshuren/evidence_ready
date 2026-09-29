import { beforeEach, describe, expect, it } from "vitest";
import {
  loadSession,
  saveSession,
  clearSession,
  SESSION_PERSISTENCE_WARNING,
  SESSION_STORAGE_KEY,
} from "./session";
import { KETTLE_FIELDS } from "./domain/fields";
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
          citation: {
            documentId: "spec",
            page: 1,
            quote: "1.5 L",
            surroundingWindow: "...Capacity: 1.5 L...",
          },
          source: "document",
        },
        {
          value: "1.7 L",
          normalizedValue: "1.7 L",
          citation: {
            documentId: "manual",
            page: 2,
            quote: "1.7 L",
            surroundingWindow: "...Capacity: 1.7 L...",
          },
          source: "document",
        },
      ],
      adjudicatedLosers: [
        {
          value: "1.7 L",
          normalizedValue: "1.7 L",
          citation: {
            documentId: "manual",
            page: 2,
            quote: "1.7 L",
            surroundingWindow: "...Capacity: 1.7 L...",
          },
          source: "document",
        },
      ],
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

function fullKettleDossier(): DossierField[] {
  return KETTLE_FIELDS.map((field) => ({
    key: field.key,
    label: field.label,
    group: field.group,
    tier: field.tier,
    valueKind: field.valueKind,
    status: "missing" as const,
    originalValue: null,
    normalizedValue: null,
    markers: [],
    evidence: [],
    rejectedCandidates: [],
    conflictCandidates: [],
    adjudicatedLosers: [],
    resolutionHistory: [],
  }));
}

function dossierWithCapacityConflict(): DossierField[] {
  return fullKettleDossier().map((field) =>
    field.key === "capacity"
      ? {
          ...field,
          status: "conflicting" as const,
          originalValue: ["1.5 L", "1.7 L"],
          normalizedValue: ["1.5 L", "1.7 L"],
          conflictCandidates: [
            {
              value: "1.5 L",
              normalizedValue: "1.5 L",
              citation: {
                documentId: "spec",
                page: 1,
                quote: "1.5 L",
                surroundingWindow: "...Capacity: 1.5 L...",
              },
              source: "document" as const,
            },
            {
              value: "1.7 L",
              normalizedValue: "1.7 L",
              citation: {
                documentId: "manual",
                page: 2,
                quote: "1.7 L",
                surroundingWindow: "...Capacity: 1.7 L...",
              },
              source: "document" as const,
            },
          ],
          adjudicatedLosers: [
            {
              value: "1.7 L",
              normalizedValue: "1.7 L",
              citation: {
                documentId: "manual",
                page: 2,
                quote: "1.7 L",
                surroundingWindow: "...Capacity: 1.7 L...",
              },
              source: "document" as const,
            },
          ],
        }
      : field,
  );
}

function validStoredSession(
  now: Date,
  overrides: Record<string, unknown> = {},
) {
  return {
    version: 2 as const,
    updatedAt: now.toISOString(),
    phase: "extracted" as const,
    dossier: fullKettleDossier(),
    rejected: [],
    mode: "recorded" as const,
    counts: { extracted: 0, rejected: 0, conflicts: 0, missing: 15 },
    interview: sampleInterview(),
    excerpts: [],
    ...overrides,
  };
}

describe("loadSession", () => {
  it("returns null when storage is empty", () => {
    expect(loadSession()).toEqual({ session: null, notice: null });
  });

  it("clears intake, extracting, invalid version, and malformed sessions with no notice", () => {
    const now = new Date("2026-09-20T12:00:00.000Z");
    const base = {
      version: 2,
      updatedAt: now.toISOString(),
      dossier: sampleDossier(),
      rejected: [],
      mode: "recorded" as const,
      counts: { extracted: 1, rejected: 0, conflicts: 1, missing: 14 },
      interview: sampleInterview(),
      excerpts: [],
    };

    for (const phase of ["intake", "extracting"] as const) {
      store.clear();
      store.set(
        SESSION_STORAGE_KEY,
        JSON.stringify({ ...base, phase }),
      );
      expect(loadSession({ now })).toEqual({ session: null, notice: null });
      expect(store.has(SESSION_STORAGE_KEY)).toBe(false);
    }

    store.clear();
    store.set(
      SESSION_STORAGE_KEY,
      JSON.stringify({ ...base, phase: "interview", version: 1 }),
    );
    expect(loadSession({ now })).toEqual({ session: null, notice: null });
    expect(store.has(SESSION_STORAGE_KEY)).toBe(false);

    store.clear();
    store.set(SESSION_STORAGE_KEY, "{");
    expect(loadSession({ now })).toEqual({ session: null, notice: null });
    expect(store.has(SESSION_STORAGE_KEY)).toBe(false);
  });

  it("rejects inconsistent sessions with the restore notice", () => {
    const now = new Date("2026-09-20T12:00:00.000Z");
    const notice = "The saved session could not be restored.";

    store.set(
      SESSION_STORAGE_KEY,
      JSON.stringify(
        validStoredSession(now, {
          dossier: sampleDossier(),
        }),
      ),
    );
    expect(loadSession({ now })).toEqual({ session: null, notice });
    expect(store.has(SESSION_STORAGE_KEY)).toBe(false);

    store.set(
      SESSION_STORAGE_KEY,
      JSON.stringify(
        validStoredSession(now, {
          interview: {
            ...sampleInterview(),
            askedFieldKeys: ["not-a-kettle-field"],
          },
        }),
      ),
    );
    expect(loadSession({ now })).toEqual({ session: null, notice });

    store.set(
      SESSION_STORAGE_KEY,
      JSON.stringify(
        validStoredSession(now, {
          updatedAt: "not-a-date",
        }),
      ),
    );
    expect(loadSession({ now })).toEqual({ session: null, notice });
  });

  it("restores extracted with counts when the dossier is consistent", () => {
    const now = new Date("2026-09-20T12:00:00.000Z");
    const stored = validStoredSession(now);
    store.set(SESSION_STORAGE_KEY, JSON.stringify(stored));

    expect(loadSession({ now })).toEqual({ session: stored, notice: null });
  });

  it("expires sessions older than seven days and keeps future timestamps", () => {
    const now = new Date("2026-09-20T12:00:00.000Z");
    const expiredAt = new Date("2026-09-12T11:59:59.999Z");
    const futureAt = new Date("2026-09-21T00:00:00.000Z");
    const expiryNotice =
      "The saved session expired after seven days without activity.";

    store.set(
      SESSION_STORAGE_KEY,
      JSON.stringify(
        validStoredSession(expiredAt, {
          updatedAt: expiredAt.toISOString(),
        }),
      ),
    );
    expect(loadSession({ now })).toEqual({
      session: null,
      notice: expiryNotice,
    });
    expect(store.has(SESSION_STORAGE_KEY)).toBe(false);

    const futureSession = validStoredSession(futureAt, {
      updatedAt: futureAt.toISOString(),
    });
    store.set(SESSION_STORAGE_KEY, JSON.stringify(futureSession));
    expect(loadSession({ now })).toEqual({
      session: futureSession,
      notice: null,
    });
  });
});

describe("saveSession", () => {
  it("round-trips version 2 with phase, counts, interview flags, and surroundingWindow", () => {
    const now = new Date("2026-09-20T12:00:00.000Z");
    const session = {
      phase: "extracted" as const,
      dossier: dossierWithCapacityConflict(),
      rejected: [],
      mode: "recorded" as const,
      counts: { extracted: 2, rejected: 0, conflicts: 1, missing: 14 },
      failedSources: [
        {
          id: "bad-doc",
          filename: "bad.pdf",
          code: "parse-failed",
          message: "Could not read PDF.",
        },
      ],
      interview: {
        ...sampleInterview(),
        pausedForBudget: true,
        essentialsClear: false,
        continueSupporting: true,
        exhaustedFieldKeys: ["rated-power"],
      },
      excerpts: [
        {
          documentId: "spec",
          page: 1,
          quote: "1.5 L",
          surroundingWindow: "Capacity: 1.5 L",
        },
      ],
    };

    saveSession(session, { now });
    const loaded = loadSession({ now });

    expect(loaded).toEqual({
      session: {
        version: 2,
        updatedAt: now.toISOString(),
        ...session,
      },
      notice: null,
    });
  });

  it("round-trips dossier, mode, and interview", () => {
    const now = new Date("2026-09-20T12:00:00.000Z");
    const session = {
      phase: "interview" as const,
      dossier: dossierWithCapacityConflict(),
      rejected: [],
      mode: "recorded" as const,
      counts: { extracted: 2, rejected: 0, conflicts: 1, missing: 14 },
      interview: sampleInterview(),
      excerpts: [{ documentId: "spec", page: 1, quote: "1.5 L", surroundingWindow: "Capacity: 1.5 L" }],
    };

    saveSession(session, { now });

    expect(loadSession({ now })).toEqual({
      session: {
        version: 2,
        updatedAt: now.toISOString(),
        ...session,
      },
      notice: null,
    });
  });

  it("returns the spec warning when storage quota is exceeded", () => {
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
      phase: "interview" as const,
      dossier: fullKettleDossier(),
      rejected: [],
      mode: "recorded" as const,
      counts: { extracted: 0, rejected: 0, conflicts: 0, missing: 15 },
      interview: sampleInterview(),
      excerpts: [],
    };

    const result = saveSession(session);

    expect(result).toEqual({
      warned: true,
      warning: SESSION_PERSISTENCE_WARNING,
    });
    expect(loadSession().session).toMatchObject({
      version: 2,
      phase: "interview",
    });
  });

  it("returns the spec warning when localStorage is unavailable", () => {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: undefined,
    });

    const session = {
      phase: "interview" as const,
      dossier: fullKettleDossier(),
      rejected: [],
      mode: "recorded" as const,
      counts: { extracted: 0, rejected: 0, conflicts: 0, missing: 15 },
      interview: sampleInterview(),
      excerpts: [],
    };

    expect(saveSession(session)).toEqual({
      warned: true,
      warning: SESSION_PERSISTENCE_WARNING,
    });
  });
});
