import { describe, expect, it } from "vitest";
import { KETTLE_FIELDS } from "./fields.js";
import { applyEvent, parseAnswer } from "./apply.js";
import { authoringReadiness } from "./readiness.js";
import type { DossierField, Evidence, Proposal } from "./types.js";

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

function dossierWith(field: DossierField): DossierField[] {
  return KETTLE_FIELDS.map((def) =>
    def.key === field.key ? field : dossierField(def.key, { status: "confirmed" }),
  );
}

const sampleEvidence: Evidence = {
  documentId: "supplier-spec",
  page: 2,
  quote: "1.5 L",
  surroundingWindow: "...Capacity: 1.5 L...",
};

const manualEvidence: Evidence = {
  documentId: "draft-manual",
  page: 3,
  quote: "1.7 L",
  surroundingWindow: "...Capacity: 1.7 L...",
};

const capacityConflictCandidates = [
  {
    value: "1.5 L",
    normalizedValue: "1.5 L",
    citation: sampleEvidence,
    source: "document" as const,
  },
  {
    value: "1.7 L",
    normalizedValue: "1.7 L",
    citation: manualEvidence,
    source: "document" as const,
  },
];

describe("parseAnswer", () => {
  it("trims whitespace, treats empty as declare-unavailable, and non-empty as provide-answer", () => {
    expect(parseAnswer("importer-contact", "   ")).toEqual({
      type: "declare-unavailable",
      fieldKey: "importer-contact",
    });
    expect(parseAnswer("importer-contact", "")).toEqual({
      type: "declare-unavailable",
      fieldKey: "importer-contact",
    });
    expect(parseAnswer("importer-contact", "  Acme Imports GmbH  ")).toEqual({
      type: "provide-answer",
      fieldKey: "importer-contact",
      value: "Acme Imports GmbH",
    });
  });
});

describe("applyEvent provide-answer", () => {
  it("writes a missing field as user-provided with normalized value and history", () => {
    const dossier = dossierWith(
      dossierField("importer-contact", { status: "missing", valueKind: "prose" }),
    );

    const result = applyEvent(dossier, {
      type: "provide-answer",
      fieldKey: "importer-contact",
      value: "Acme Imports GmbH, Berlin",
    });

    const field = result.dossier.find((item) => item.key === "importer-contact")!;
    expect(field.status).toBe("user-provided");
    expect(field.originalValue).toBe("Acme Imports GmbH, Berlin");
    expect(field.normalizedValue).toBe("Acme Imports GmbH, Berlin");
    expect(field.resolutionHistory).toHaveLength(1);
    expect(field.resolutionHistory[0]?.action).toBe("user-provided");
  });

  it("writes an unverified field as user-provided and retains rejected candidates", () => {
    const rejected = {
      fieldKey: "rated-power",
      value: "2200 W",
      citation: { documentId: "supplier-spec", page: 2, quote: "2200 W" },
      rejectionReason: "quote not on page",
    };
    const staleEvidence: Evidence = {
      documentId: "supplier-spec",
      page: 2,
      quote: "1850 W",
      surroundingWindow: "...1850 W...",
    };
    const dossier = dossierWith(
      dossierField("rated-power", {
        status: "unverified",
        originalValue: "2200 W",
        normalizedValue: "2200 W",
        evidence: [staleEvidence],
        rejectedCandidates: [rejected],
      }),
    );

    const result = applyEvent(dossier, {
      type: "provide-answer",
      fieldKey: "rated-power",
      value: "1850 W",
    });

    const field = result.dossier.find((item) => item.key === "rated-power")!;
    expect(field.status).toBe("user-provided");
    expect(field.originalValue).toBe("1850 W");
    expect(field.normalizedValue).toBe("1850 W");
    expect(field.rejectedCandidates).toEqual([rejected]);
    expect(field.evidence).toEqual([]);
    expect(field.conflictCandidates).toEqual([]);
    expect(field.adjudicatedLosers).toEqual([]);
  });

  it("creates a user-vs-document conflict when answering a confirmed field", () => {
    const dossier = dossierWith(
      dossierField("capacity", {
        status: "confirmed",
        originalValue: "1.5 L",
        normalizedValue: "1.5 L",
        evidence: [sampleEvidence],
      }),
    );

    const result = applyEvent(dossier, {
      type: "provide-answer",
      fieldKey: "capacity",
      value: "1.7 L",
    });

    const field = result.dossier.find((item) => item.key === "capacity")!;
    expect(field.status).toBe("conflicting");
    expect(field.originalValue).toEqual(["1.5 L", "1.7 L"]);
    expect(field.normalizedValue).toEqual(["1.5 L", "1.7 L"]);
    expect(field.evidence).toEqual([sampleEvidence]);
    expect(field.conflictCandidates).toEqual([
      {
        value: "1.5 L",
        normalizedValue: "1.5 L",
        citation: sampleEvidence,
        source: "document",
      },
      {
        value: "1.7 L",
        normalizedValue: "1.7 L",
        source: "user",
      },
    ]);
    expect(field.resolutionHistory.at(-1)?.action).toBe("user-conflict");
  });

  it("keeps a conflicting field conflicting when answered again", () => {
    const dossier = dossierWith(
      dossierField("capacity", {
        status: "conflicting",
        originalValue: ["1.5 L", "1.7 L"],
        normalizedValue: ["1.5 L", "1.7 L"],
        evidence: [sampleEvidence],
        conflictCandidates: capacityConflictCandidates,
      }),
    );

    const result = applyEvent(dossier, {
      type: "provide-answer",
      fieldKey: "capacity",
      value: "2.0 L",
    });

    const field = result.dossier.find((item) => item.key === "capacity")!;
    expect(field.status).toBe("conflicting");
    expect(field.originalValue).toEqual(["1.5 L", "1.7 L", "2.0 L"]);
    expect(field.normalizedValue).toEqual(["1.5 L", "1.7 L", "2 L"]);
    expect(field.conflictCandidates).toEqual([
      ...capacityConflictCandidates,
      { value: "2.0 L", normalizedValue: "2 L", source: "user" },
    ]);
    expect(field.resolutionHistory.at(-1)?.action).toBe("user-conflict");
    expect(authoringReadiness(result.dossier).verdict).toBe("needs-review");
  });

  it("persists optional user source metadata on a missing field answer", () => {
    const dossier = dossierWith(
      dossierField("importer-contact", { status: "missing", valueKind: "prose" }),
    );

    const result = applyEvent(dossier, {
      type: "provide-answer",
      fieldKey: "importer-contact",
      value: "Acme Imports GmbH",
      sourceDescription: "purchase order PO-2214",
    });

    const field = result.dossier.find((item) => item.key === "importer-contact")!;
    expect(field.userSourceDescription).toBe("purchase order PO-2214");
  });
});

describe("applyEvent adjudicate", () => {
  it("adjudicates a conflict to confirmed with an adjudicated marker and retains the loser", () => {
    const dossier = dossierWith(
      dossierField("capacity", {
        status: "conflicting",
        originalValue: ["1.5 L", "1.7 L"],
        normalizedValue: ["1.5 L", "1.7 L"],
        evidence: [sampleEvidence, manualEvidence],
        conflictCandidates: capacityConflictCandidates,
      }),
    );

    const result = applyEvent(dossier, {
      type: "adjudicate",
      fieldKey: "capacity",
      selectedValue: "1.5 L",
    });

    const field = result.dossier.find((item) => item.key === "capacity")!;
    expect(field.status).toBe("confirmed");
    expect(field.originalValue).toBe("1.5 L");
    expect(field.normalizedValue).toBe("1.5 L");
    expect(field.markers).toContain("adjudicated");
    expect(field.conflictCandidates).toEqual([]);
    expect(field.adjudicatedLosers).toEqual([capacityConflictCandidates[1]]);
    expect(field.evidence).toEqual([sampleEvidence]);
    expect(field.resolutionHistory.at(-1)?.action).toBe("adjudicated");
    expect(field.resolutionHistory.at(-1)?.detail).toContain("1.7 L");
  });

  it("leaves a conflicting field unchanged when adjudicating with an empty value", () => {
    const dossier = dossierWith(
      dossierField("capacity", {
        status: "conflicting",
        originalValue: ["1.5 L", "1.7 L"],
        normalizedValue: ["1.5 L", "1.7 L"],
        evidence: [sampleEvidence, manualEvidence],
        conflictCandidates: capacityConflictCandidates,
      }),
    );

    const result = applyEvent(dossier, {
      type: "adjudicate",
      fieldKey: "capacity",
      selectedValue: "   ",
    });

    const field = result.dossier.find((item) => item.key === "capacity")!;
    expect(field.status).toBe("conflicting");
    expect(field.conflictCandidates).toEqual(capacityConflictCandidates);
  });

  it("retains every non-winner with provenance when adjudicating a three-way conflict", () => {
    const userCandidate = {
      value: "2.0 L",
      normalizedValue: "2 L",
      source: "user" as const,
    };
    const candidates = [...capacityConflictCandidates, userCandidate];
    const dossier = dossierWith(
      dossierField("capacity", {
        status: "conflicting",
        originalValue: ["1.5 L", "1.7 L", "2.0 L"],
        normalizedValue: ["1.5 L", "1.7 L", "2 L"],
        evidence: [sampleEvidence, manualEvidence],
        conflictCandidates: candidates,
      }),
    );

    const result = applyEvent(dossier, {
      type: "adjudicate",
      fieldKey: "capacity",
      selectedValue: "2.0 L",
    });

    const field = result.dossier.find((item) => item.key === "capacity")!;
    expect(field.status).toBe("user-provided");
    expect(field.originalValue).toBe("2.0 L");
    expect(field.normalizedValue).toBe("2 L");
    expect(field.markers).toContain("adjudicated");
    expect(field.conflictCandidates).toEqual([]);
    expect(field.adjudicatedLosers).toEqual(capacityConflictCandidates);
    expect(field.evidence).toEqual([]);
  });

  it("adjudicates a custom user value and retains every document candidate as a loser", () => {
    const dossier = dossierWith(
      dossierField("capacity", {
        status: "conflicting",
        originalValue: ["1.5 L", "1.7 L"],
        normalizedValue: ["1.5 L", "1.7 L"],
        evidence: [sampleEvidence, manualEvidence],
        conflictCandidates: capacityConflictCandidates,
      }),
    );

    const result = applyEvent(dossier, {
      type: "adjudicate",
      fieldKey: "capacity",
      selectedValue: "1.6 L",
    });

    const field = result.dossier.find((item) => item.key === "capacity")!;
    expect(field.status).toBe("user-provided");
    expect(field.originalValue).toBe("1.6 L");
    expect(field.normalizedValue).toBe("1.6 L");
    expect(field.markers).toContain("adjudicated");
    expect(field.conflictCandidates).toEqual([]);
    expect(field.adjudicatedLosers).toEqual(capacityConflictCandidates);
  });
});

describe("applyEvent declare-unavailable", () => {
  it("marks a field missing with declaredUnavailable and still blocks readiness", () => {
    const dossier = dossierWith(
      dossierField("importer-contact", { status: "missing", valueKind: "prose" }),
    );

    const result = applyEvent(dossier, {
      type: "declare-unavailable",
      fieldKey: "importer-contact",
    });

    const field = result.dossier.find((item) => item.key === "importer-contact")!;
    expect(field.status).toBe("missing");
    expect(field.markers).toContain("declaredUnavailable");
    expect(authoringReadiness(result.dossier).verdict).toBe("needs-review");
  });

  it("clears supporting evidence and conflict state when declaring a field unavailable", () => {
    const dossier = dossierWith(
      dossierField("capacity", {
        status: "conflicting",
        originalValue: ["1.5 L", "1.7 L"],
        normalizedValue: ["1.5 L", "1.7 L"],
        evidence: [sampleEvidence, manualEvidence],
        conflictCandidates: capacityConflictCandidates,
        adjudicatedLosers: [capacityConflictCandidates[0]!],
      }),
    );

    const result = applyEvent(dossier, {
      type: "declare-unavailable",
      fieldKey: "capacity",
    });

    const field = result.dossier.find((item) => item.key === "capacity")!;
    expect(field.status).toBe("missing");
    expect(field.originalValue).toBeNull();
    expect(field.normalizedValue).toBeNull();
    expect(field.evidence).toEqual([]);
    expect(field.conflictCandidates).toEqual([]);
    expect(field.adjudicatedLosers).toEqual([]);
    expect(field.markers).toContain("declaredUnavailable");
  });
});

describe("applyEvent apply-proposals", () => {
  it("writes user-provided proposals, creates conflicts on confirmed fields, and discards unknown keys", () => {
    const dossier = dossierWith(
      dossierField("importer-contact", { status: "missing", valueKind: "prose" }),
    ).map((field) =>
      field.key === "capacity"
        ? dossierField("capacity", {
            status: "confirmed",
            originalValue: "1.5 L",
            normalizedValue: "1.5 L",
            evidence: [sampleEvidence],
          })
        : field,
    );

    const proposals: Proposal[] = [
      {
        fieldKey: "importer-contact",
        proposedValue: "Acme Imports GmbH",
        answerText: "Acme Imports GmbH in Berlin",
      },
      {
        fieldKey: "capacity",
        proposedValue: "1.7 L",
        answerText: "Actually 1.7 L",
      },
      {
        fieldKey: "unknown-field",
        proposedValue: "ignored",
        answerText: "ignored",
      },
    ];

    const result = applyEvent(dossier, {
      type: "apply-proposals",
      proposals,
    });

    const importer = result.dossier.find((item) => item.key === "importer-contact")!;
    const capacity = result.dossier.find((item) => item.key === "capacity")!;
    expect(importer.status).toBe("user-provided");
    expect(capacity.status).toBe("conflicting");
    expect(result.dossier.some((item) => item.key === "unknown-field")).toBe(false);
  });

  it("keeps a conflicting field conflicting when a proposal contradicts it", () => {
    const dossier = dossierWith(
      dossierField("capacity", {
        status: "conflicting",
        originalValue: ["1.5 L", "1.7 L"],
        normalizedValue: ["1.5 L", "1.7 L"],
        evidence: [sampleEvidence],
      }),
    );

    const result = applyEvent(dossier, {
      type: "apply-proposals",
      proposals: [
        {
          fieldKey: "capacity",
          proposedValue: "2.0 L",
          answerText: "Actually 2.0 L",
        },
      ],
    });

    const field = result.dossier.find((item) => item.key === "capacity")!;
    expect(field.status).toBe("conflicting");
    expect(field.originalValue).toEqual(["1.5 L", "1.7 L", "2.0 L"]);
    expect(authoringReadiness(result.dossier).verdict).toBe("needs-review");
  });

  it("does not mutate the input dossier", () => {
    const dossier = dossierWith(
      dossierField("importer-contact", { status: "missing", valueKind: "prose" }),
    );
    const snapshot = structuredClone(dossier);

    applyEvent(dossier, {
      type: "provide-answer",
      fieldKey: "importer-contact",
      value: "Acme Imports GmbH",
    });

    expect(dossier).toEqual(snapshot);
  });
});
