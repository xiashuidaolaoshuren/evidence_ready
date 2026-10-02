// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DossierPanel } from "./DossierPanel";
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

describe("DossierPanel", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders status labels and groups", () => {
    render(
      <DossierPanel
        dossier={[
          field("product-name", "Product name", {
            status: "confirmed",
            originalValue: "AromaSteam Electric Kettle",
            normalizedValue: "AromaSteam Electric Kettle",
          }),
          field("capacity", "Capacity", {
            group: "Electrical and Physical Information",
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
          }),
        ]}
        onOpenSource={vi.fn()}
        onOpenRejected={vi.fn()}
      />,
    );

    expect(screen.getByText("Identity and Responsibility")).toBeInTheDocument();
    expect(screen.getByText("Electrical and Physical Information")).toBeInTheDocument();
    expect(screen.getByText("Confirmed")).toBeInTheDocument();
    expect(screen.getByText("Conflicting")).toBeInTheDocument();
  });

  it("shows user-provided source description when present", () => {
    render(
      <DossierPanel
        dossier={[
          field("importer-contact", "Importer or responsible-party contact", {
            status: "user-provided",
            valueKind: "prose",
            originalValue: "Acme Imports GmbH",
            normalizedValue: "Acme Imports GmbH",
            userSourceDescription: "purchase order PO-2214",
          }),
        ]}
        onOpenSource={vi.fn()}
        onOpenRejected={vi.fn()}
      />,
    );

    expect(screen.getByText(/purchase order PO-2214/i)).toBeInTheDocument();
  });

  it("applies flash class to the matching dossier row", () => {
    render(
      <DossierPanel
        dossier={[
          field("product-name", "Product name", {
            status: "confirmed",
            originalValue: "AromaSteam Electric Kettle",
            normalizedValue: "AromaSteam Electric Kettle",
          }),
          field("capacity", "Capacity", {
            group: "Electrical and Physical Information",
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
          }),
        ]}
        flashKey="capacity"
        onOpenSource={vi.fn()}
        onOpenRejected={vi.fn()}
      />,
    );

    const row = screen.getByText("Capacity").closest(".d-row") as HTMLElement;
    expect(row.classList.contains("flash")).toBe(true);
  });

  it("shows bundled PDF filenames on source links", () => {
    render(
      <DossierPanel
        dossier={[
          field("model-identifier", "Model identifier", {
            status: "confirmed",
            originalValue: "ARK-1500",
            normalizedValue: "ARK-1500",
            evidence: [
              {
                documentId: "ARK-1500_supplier-specification",
                page: 1,
                quote: "ARK-1500",
                surroundingWindow: "Model identifier: ARK-1500",
              },
            ],
          }),
        ]}
        onOpenSource={vi.fn()}
        onOpenRejected={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", {
        name: "ARK-1500_supplier-specification.pdf p.1",
      }),
    ).toBeInTheDocument();
  });

  it("preserves bundled TXT filenames without inventing a PDF suffix", () => {
    render(
      <DossierPanel
        dossier={[
          field("intended-use", "Intended use", {
            status: "confirmed",
            valueKind: "prose",
            originalValue: "Boiling water",
            normalizedValue: "Boiling water",
            evidence: [
              {
                documentId: "ARK-1500_supplier-specification.txt",
                page: 2,
                quote: "Boiling water",
                surroundingWindow: "Intended use: boiling water",
              },
            ],
          }),
        ]}
        onOpenSource={vi.fn()}
        onOpenRejected={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", {
        name: "ARK-1500_supplier-specification.txt p.2",
      }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/\.txt\.pdf/i)).not.toBeInTheDocument();
  });

  it("joins list field values with middle dots", () => {
    render(
      <DossierPanel
        dossier={[
          field("primary-materials", "Primary materials", {
            group: "Electrical and Physical Information",
            tier: "supporting",
            valueKind: "list",
            status: "confirmed",
            originalValue: ["stainless steel", "plastic"],
            normalizedValue: ["stainless steel", "plastic"],
          }),
        ]}
        onOpenSource={vi.fn()}
        onOpenRejected={vi.fn()}
      />,
    );

    expect(screen.getByText("stainless steel · plastic")).toBeInTheDocument();
  });

  it("never renders a conflicting field as confirmed", () => {
    render(
      <DossierPanel
        dossier={[
          field("capacity", "Capacity", {
            group: "Electrical and Physical Information",
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
          }),
        ]}
        onOpenSource={vi.fn()}
        onOpenRejected={vi.fn()}
      />,
    );

    const row = screen.getByText("Capacity").closest(".d-row") as HTMLElement;
    expect(row).toBeTruthy();
    expect(within(row).getByText("Conflicting")).toBeInTheDocument();
    expect(within(row).queryByText("Confirmed")).not.toBeInTheDocument();
  });
});
