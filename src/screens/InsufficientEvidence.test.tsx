// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InsufficientEvidence } from "./InsufficientEvidence";
import type { DossierField } from "@/domain/types";

function field(
  key: string,
  label: string,
  overrides: Partial<DossierField> = {},
): DossierField {
  return {
    key,
    label,
    group: "Identity and Responsibility",
    tier: "essential",
    valueKind: "scalar",
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

describe("InsufficientEvidence", () => {
  afterEach(() => {
    cleanup();
  });

  it("lists found fields, threshold note as counts, and dispatches both CTAs", async () => {
    const user = userEvent.setup();
    const onAddDocument = vi.fn();
    const onContinueAnyway = vi.fn();

    render(
      <InsufficientEvidence
        dossier={[
          field("product-name", "Product name", {
            status: "confirmed",
            originalValue: "AromaSteam Electric Kettle",
            normalizedValue: "AromaSteam Electric Kettle",
            evidence: [
              {
                documentId: "flyer",
                page: 1,
                quote: "AromaSteam Electric Kettle",
                surroundingWindow: "AromaSteam Electric Kettle",
              },
            ],
          }),
          field("intended-use", "Intended use", {
            status: "confirmed",
            originalValue: "Boiling drinking water.",
            normalizedValue: "Boiling drinking water.",
            evidence: [
              {
                documentId: "flyer",
                page: 1,
                quote: "for boiling drinking water",
                surroundingWindow: "for boiling drinking water",
              },
            ],
          }),
        ]}
        failedSources={undefined}
        onAddDocument={onAddDocument}
        onContinueAnyway={onContinueAnyway}
      />,
    );

    expect(
      screen.getByRole("heading", {
        name: /don't carry enough product information/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Product name")).toBeInTheDocument();
    expect(screen.getByText(/AromaSteam Electric Kettle/)).toBeInTheDocument();
    expect(screen.getByText("Intended use")).toBeInTheDocument();
    expect(
      screen.getByText(/2 of 9 essential fields produced a candidate/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/the threshold is 5/i)).toBeInTheDocument();
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /add another document/i }),
    );
    expect(onAddDocument).toHaveBeenCalledOnce();

    await user.click(
      screen.getByRole("button", { name: /continue anyway/i }),
    );
    expect(onContinueAnyway).toHaveBeenCalledOnce();
  });
});
