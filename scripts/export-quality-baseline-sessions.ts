import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { KETTLE_FIELDS } from "../src/domain/fields";
import type { DossierField } from "../src/domain/types";
import type { StoredSession } from "../src/state/session";

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
                documentId: "ARK-1500_supplier-specification.pdf",
                page: 2,
                quote: "1.5 L",
                surroundingWindow: "Capacity: 1.5 L",
              },
              source: "document" as const,
            },
            {
              value: "1.7 L",
              normalizedValue: "1.7 L",
              citation: {
                documentId: "ARK-1500_user-manual.pdf",
                page: 4,
                quote: "1.7 L",
                surroundingWindow: "Capacity: 1.7 L",
              },
              source: "document" as const,
            },
          ],
          adjudicatedLosers: [
            {
              value: "1.7 L",
              normalizedValue: "1.7 L",
              citation: {
                documentId: "ARK-1500_user-manual.pdf",
                page: 4,
                quote: "1.7 L",
                surroundingWindow: "Capacity: 1.7 L",
              },
              source: "document" as const,
            },
          ],
        }
      : field.key === "importer-contact"
        ? {
            ...field,
            status: "missing" as const,
            valueKind: "prose" as const,
          }
        : field.key === "rated-power"
          ? {
              ...field,
              status: "unverified" as const,
              originalValue: "2200 W",
              normalizedValue: "2200 W",
              evidence: [
                {
                  documentId: "ARK-1500_supplier-specification.pdf",
                  page: 2,
                  quote: "2200 W",
                  surroundingWindow: "Rated power: 2200 W",
                },
              ],
            }
          : field.key === "product-name"
            ? {
                ...field,
                status: "confirmed" as const,
                originalValue: "Acme Rapid Kettle",
                normalizedValue: "Acme Rapid Kettle",
              }
            : field,
  );
}

const now = "2026-10-12T05:00:00.000Z";
const baseInterview = {
  phase: "interview" as const,
  currentQuestionFieldKey: "capacity",
  askedFieldKeys: ["capacity"],
  answeredFieldKeys: [],
  declaredUnavailableFieldKeys: [],
  questionCount: 0,
  continuePastBudget: false,
  completionReason: null,
};

function session(
  overrides: Partial<Omit<StoredSession, "version" | "updatedAt">>,
): StoredSession {
  return {
    version: 2,
    updatedAt: now,
    phase: "interview",
    dossier: dossierWithCapacityConflict(),
    rejected: [],
    mode: "recorded",
    counts: { extracted: 15, rejected: 1, conflicts: 1, missing: 1 },
    interview: baseInterview,
    excerpts: [],
    ...overrides,
  };
}

const sessions = {
  insufficient: session({
    phase: "insufficient",
    dossier: fullKettleDossier(),
    counts: { extracted: 0, rejected: 0, conflicts: 0, missing: 15 },
    failedSources: [
      {
        id: "thin-flyer",
        filename: "thin-lifestyle-flyer.txt",
        code: "empty",
        message: "No extractable product fields were found.",
      },
    ],
    interview: {
      ...baseInterview,
      phase: "intake",
      currentQuestionFieldKey: null,
      askedFieldKeys: [],
      questionCount: 0,
    },
  }),
  interviewConflict: session({
    interview: {
      ...baseInterview,
      currentQuestionFieldKey: "capacity",
      askedFieldKeys: [],
    },
  }),
  interviewMissing: session({
    dossier: dossierWithCapacityConflict().map((field) =>
      field.key === "capacity"
        ? {
            ...field,
            status: "confirmed" as const,
            originalValue: "1.5 L",
            normalizedValue: "1.5 L",
            markers: ["adjudicated"],
            conflictCandidates: [],
          }
        : field,
    ),
    interview: {
      ...baseInterview,
      currentQuestionFieldKey: "importer-contact",
      askedFieldKeys: ["capacity"],
      answeredFieldKeys: ["capacity"],
      questionCount: 1,
    },
  }),
  interviewUnverified: session({
    dossier: dossierWithCapacityConflict().map((field) =>
      field.key === "capacity"
        ? {
            ...field,
            status: "confirmed" as const,
            originalValue: "1.5 L",
            normalizedValue: "1.5 L",
            markers: ["adjudicated"],
            conflictCandidates: [],
          }
        : field.key === "importer-contact"
          ? {
              ...field,
              status: "user-provided" as const,
              originalValue: "Acme Imports Ltd",
              normalizedValue: "Acme Imports Ltd",
            }
          : field,
    ),
    interview: {
      ...baseInterview,
      currentQuestionFieldKey: "rated-power",
      askedFieldKeys: ["capacity", "importer-contact"],
      answeredFieldKeys: ["capacity", "importer-contact"],
      questionCount: 2,
    },
  }),
  interviewBudget: session({
    interview: {
      ...baseInterview,
      currentQuestionFieldKey: null,
      askedFieldKeys: ["capacity", "importer-contact", "rated-power", "rated-voltage", "product-name"],
      answeredFieldKeys: ["capacity", "importer-contact", "rated-power", "rated-voltage", "product-name"],
      questionCount: 5,
      pausedForBudget: true,
    },
  }),
  report: session({
    phase: "report",
    dossier: dossierWithCapacityConflict().map((field) =>
      field.key === "capacity"
        ? {
            ...field,
            status: "confirmed" as const,
            originalValue: "1.5 L",
            normalizedValue: "1.5 L",
            markers: ["adjudicated"],
          }
        : field,
    ),
    interview: {
      ...baseInterview,
      completionReason: "user-finished",
      questionCount: 3,
    },
  }),
};

const outDir = join(process.cwd(), "docs/design/quality-baseline");
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "sessions.json"), JSON.stringify(sessions, null, 2));
