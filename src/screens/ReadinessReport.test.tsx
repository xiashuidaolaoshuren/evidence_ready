// @vitest-environment jsdom
import userEvent from "@testing-library/user-event";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { KETTLE_FIELDS } from "@/domain/fields.js";
import type { DossierField } from "@/domain/types.js";
import { ReadinessReport } from "./ReadinessReport.js";

function field(
  key: string,
  overrides: Partial<DossierField> = {},
): DossierField {
  const def = KETTLE_FIELDS.find((entry) => entry.key === key);
  return {
    key,
    label: def?.label ?? key,
    group: def?.group ?? "Identity and Responsibility",
    tier: def?.tier ?? "essential",
    valueKind: def?.valueKind ?? "scalar",
    status: "confirmed",
    originalValue: "ok",
    normalizedValue: "ok",
    markers: [],
    evidence: [],
    rejectedCandidates: [],
    conflictCandidates: [],
    adjudicatedLosers: [],
    resolutionHistory: [],
    ...overrides,
  };
}

function readyDossier(): DossierField[] {
  return KETTLE_FIELDS.map((def) =>
    field(def.key, {
      status: def.tier === "essential" ? "confirmed" : "missing",
      originalValue: def.tier === "essential" ? "ok" : null,
      normalizedValue: def.tier === "essential" ? "ok" : null,
    }),
  );
}

const documentConflictCandidates = [
  {
    value: "1.5 L",
    normalizedValue: "1.5 L",
    source: "document" as const,
  },
  {
    value: "1.7 L",
    normalizedValue: "1.7 L",
    source: "document" as const,
  },
];

const materialsConflictCandidates = [
  {
    value: "Stainless steel",
    normalizedValue: "Stainless steel",
    source: "document" as const,
  },
  {
    value: "Plastic",
    normalizedValue: "Plastic",
    source: "document" as const,
  },
];

function dossierWithEssentialAndSupportingConflicts(): DossierField[] {
  return readyDossier().map((entry) => {
    if (entry.key === "capacity") {
      return field("capacity", {
        status: "conflicting",
        originalValue: ["1.5 L", "1.7 L"],
        normalizedValue: ["1.5 L", "1.7 L"],
        conflictCandidates: documentConflictCandidates,
      });
    }
    if (entry.key === "primary-materials") {
      return field("primary-materials", {
        status: "conflicting",
        originalValue: ["Stainless steel", "Plastic"],
        normalizedValue: ["Stainless steel", "Plastic"],
        conflictCandidates: materialsConflictCandidates,
      });
    }
    return entry;
  });
}

describe("ReadinessReport", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders Ready for manual authoring verdict with recorded mode badge", () => {
    render(
      <ReadinessReport
        dossier={readyDossier()}
        mode="recorded"
        onBackToInterview={vi.fn()}
        onRestart={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("heading", { name: /ready for manual authoring/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("Recorded extraction")).toBeInTheDocument();
  });

  it("renders Needs evidence review and failing conflict criterion", () => {
    const dossier = readyDossier().map((entry) =>
      entry.key === "capacity"
        ? field("capacity", {
            status: "conflicting",
            originalValue: ["1.5 L", "1.7 L"],
            normalizedValue: ["1.5 L", "1.7 L"],
            conflictCandidates: [
              {
                value: "1.5 L",
                normalizedValue: "1.5 L",
                source: "document",
              },
              {
                value: "1.7 L",
                normalizedValue: "1.7 L",
                source: "document",
              },
            ],
          })
        : entry,
    );

    render(
      <ReadinessReport
        dossier={dossier}
        mode="live"
        onBackToInterview={vi.fn()}
        onRestart={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("heading", { name: /needs evidence review/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/no conflict remains unadjudicated — capacity/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/no essential field is missing$/i)).toBeInTheDocument();
  });

  it("names only essential conflicts in the readiness criterion", () => {
    render(
      <ReadinessReport
        dossier={dossierWithEssentialAndSupportingConflicts()}
        mode="recorded"
        onBackToInterview={vi.fn()}
        onRestart={vi.fn()}
      />,
    );

    expect(
      screen.getByText("No conflict remains unadjudicated — Capacity"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/no conflict remains unadjudicated — capacity, primary materials/i),
    ).not.toBeInTheDocument();
  });

  it("shows supporting conflicts separately and says they do not block readiness", () => {
    render(
      <ReadinessReport
        dossier={dossierWithEssentialAndSupportingConflicts()}
        mode="recorded"
        onBackToInterview={vi.fn()}
        onRestart={vi.fn()}
      />,
    );

    const blockingHeading = screen.getByRole("heading", {
      name: /blocking conflicts/i,
    });
    const supportingHeading = screen.getByRole("heading", {
      name: /supporting conflicts/i,
    });
    const blockingSection = blockingHeading.parentElement!;
    const supportingSection = supportingHeading.parentElement!;

    expect(within(blockingSection).getByText("Capacity")).toBeInTheDocument();
    expect(
      within(blockingSection).queryByText("Primary materials"),
    ).not.toBeInTheDocument();
    expect(
      within(supportingSection).getByText("Primary materials"),
    ).toBeInTheDocument();
    expect(
      within(supportingSection).getByText("These do not block readiness."),
    ).toBeInTheDocument();
  });

  it("splits declared-unavailable from never-investigated missing essentials", () => {
    const dossier = readyDossier().map((entry) => {
      if (entry.key === "importer-contact") {
        return field("importer-contact", {
          status: "missing",
          originalValue: null,
          normalizedValue: null,
          markers: ["declaredUnavailable"],
        });
      }
      if (entry.key === "rated-power") {
        return field("rated-power", {
          status: "missing",
          originalValue: null,
          normalizedValue: null,
        });
      }
      return entry;
    });

    render(
      <ReadinessReport
        dossier={dossier}
        mode="recorded"
        onBackToInterview={vi.fn()}
        onRestart={vi.fn()}
      />,
    );

    expect(
      screen.getByText(
        /declared unavailable by you — still blocks readiness: importer or responsible-party contact/i,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/never investigated: rated power/i),
    ).toBeInTheDocument();
  });

  it("shows adjudicated losers with document provenance", () => {
    const dossier = readyDossier().map((entry) =>
      entry.key === "capacity"
        ? field("capacity", {
            status: "confirmed",
            originalValue: "1.5 L",
            normalizedValue: "1.5 L",
            markers: ["adjudicated"],
            adjudicatedLosers: [
              {
                value: "1.7 L",
                normalizedValue: "1.7 L",
                citation: {
                  documentId: "draft-manual",
                  page: 2,
                  quote: "Maximum capacity 1.7 L",
                },
                source: "document",
              },
            ],
          })
        : entry,
    );

    render(
      <ReadinessReport
        dossier={dossier}
        mode="recorded"
        onBackToInterview={vi.fn()}
        onRestart={vi.fn()}
      />,
    );

    const adjudicatedSection = screen.getByRole("heading", {
      name: /adjudicated values/i,
    }).parentElement!;

    expect(within(adjudicatedSection).getByText("Confirmed")).toBeInTheDocument();
    expect(screen.getByText(/not chosen: 1\.7 l/i)).toBeInTheDocument();
    expect(
      screen.getByText(/draft-manual, p\.2 · evidence retained/i),
    ).toBeInTheDocument();
  });

  it("shows user-provided status on an adjudicated user-supplied winner", () => {
    const dossier = readyDossier().map((entry) =>
      entry.key === "capacity"
        ? field("capacity", {
            status: "user-provided",
            originalValue: "1.6 L",
            normalizedValue: "1.6 L",
            markers: ["adjudicated"],
            adjudicatedLosers: [
              {
                value: "1.5 L",
                normalizedValue: "1.5 L",
                citation: {
                  documentId: "supplier-spec",
                  page: 2,
                  quote: "1.5 L",
                },
                source: "document",
              },
            ],
          })
        : entry,
    );

    render(
      <ReadinessReport
        dossier={dossier}
        mode="recorded"
        onBackToInterview={vi.fn()}
        onRestart={vi.fn()}
      />,
    );

    const adjudicatedSection = screen.getByRole("heading", {
      name: /adjudicated values/i,
    }).parentElement!;

    expect(
      within(adjudicatedSection).getByText("User-provided"),
    ).toBeInTheDocument();
    expect(within(adjudicatedSection).getByText("Adjudicated")).toBeInTheDocument();
    expect(within(adjudicatedSection).getByText(/not chosen: 1\.5 l/i)).toBeInTheDocument();
  });

  it("lists unverified and user-provided values and rejected candidate reasons", () => {
    const dossier = readyDossier().map((entry) => {
      if (entry.key === "importer-contact") {
        return field("importer-contact", {
          status: "user-provided",
          originalValue: "Acme Imports Ltd",
          normalizedValue: "Acme Imports Ltd",
        });
      }
      if (entry.key === "rated-power") {
        return field("rated-power", {
          status: "unverified",
          originalValue: "2200 W",
          normalizedValue: "2200 W",
          rejectedCandidates: [
            {
              fieldKey: "rated-power",
              value: "2200 W",
              citation: {
                documentId: "supplier-spec",
                page: 1,
                quote: "Rated power: 2200 W",
              },
              rejectionReason:
                "Quote not found on the cited page after whitespace normalization.",
            },
          ],
        });
      }
      return entry;
    });

    render(
      <ReadinessReport
        dossier={dossier}
        mode="recorded"
        onBackToInterview={vi.fn()}
        onRestart={vi.fn()}
      />,
    );

    const table = screen.getByRole("table");
    expect(table).toBeInTheDocument();
    expect(within(table).getByText("User-provided")).toBeInTheDocument();
    expect(within(table).getByText("Unverified")).toBeInTheDocument();
    expect(
      screen.getByText(
        /rejected candidate “2200 W”: Quote not found on the cited page/i,
      ),
    ).toBeInTheDocument();
  });

  it("opens the selected rejected candidate details instead of always using index zero", async () => {
    const user = userEvent.setup();
    const dossier = readyDossier().map((entry) => {
      if (entry.key !== "rated-power") return entry;
      return field("rated-power", {
        status: "unverified",
        originalValue: "2200 W",
        normalizedValue: "2200 W",
        rejectedCandidates: [
          {
            fieldKey: "rated-power",
            value: "2100 W",
            citation: {
              documentId: "ARK-1500_supplier-specification.pdf",
              page: 1,
              quote: "2100 W",
            },
            rejectionReason: "First rejection reason.",
          },
          {
            fieldKey: "rated-power",
            value: "2200 W",
            citation: {
              documentId: "ARK-1500_draft-manual.pdf",
              page: 3,
              quote: "2200 W",
            },
            rejectionReason: "Second rejection reason.",
          },
        ],
      });
    });

    render(
      <ReadinessReport
        dossier={dossier}
        mode="recorded"
        onBackToInterview={vi.fn()}
        onRestart={vi.fn()}
      />,
    );

    const detailButtons = screen.getAllByRole("button", { name: /details/i });
    await user.click(detailButtons[1]!);

    expect(
      screen.getByText(/ARK-1500_draft-manual\.pdf · cited page 3/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Rejected: Second rejection reason\./i),
    ).toBeInTheDocument();
  });

  it("does not show a compliance score or compliant copy", () => {
    render(
      <ReadinessReport
        dossier={readyDossier()}
        mode="recorded"
        onBackToInterview={vi.fn()}
        onRestart={vi.fn()}
      />,
    );

    expect(screen.queryByText(/compliant/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/\d+\s*%/)).not.toBeInTheDocument();
  });
});
