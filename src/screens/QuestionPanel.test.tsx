// @vitest-environment jsdom
import userEvent from "@testing-library/user-event";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QuestionPanel } from "./QuestionPanel";
import type { DossierField } from "@/domain/types";
import type { Question } from "@/domain/planner";

function field(overrides: Partial<DossierField> = {}): DossierField {
  return {
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
          documentId: "supplier-spec",
          page: 1,
          quote: "Capacity: 1.5 L",
        },
        source: "document",
      },
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
    adjudicatedLosers: [],
    resolutionHistory: [],
    ...overrides,
  };
}

describe("QuestionPanel", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders prototype question and rationale for capacity conflict", () => {
    const question: Question = { fieldKey: "capacity", shape: "conflict" };

    render(
      <QuestionPanel
        question={question}
        field={field()}
        dossier={[field()]}
        questionNumber={1}
        onAnswer={vi.fn()}
        onLeaveUnresolved={vi.fn()}
        onOpenSource={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("heading", {
        name: /which capacity is correct for the ark-1500/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /the specification and the draft manual disagree.*cannot pick a winner/i,
      ),
    ).toBeInTheDocument();
  });

  it("renders prototype rationale for importer missing", () => {
    const question: Question = { fieldKey: "importer-contact", shape: "missing" };
    const missingField: DossierField = {
      key: "importer-contact",
      label: "Importer or responsible-party contact",
      group: "Identity and Responsibility",
      tier: "essential",
      valueKind: "prose",
      status: "missing",
      originalValue: null,
      normalizedValue: null,
      markers: [],
      evidence: [],
      rejectedCandidates: [],
      conflictCandidates: [],
      adjudicatedLosers: [],
      resolutionHistory: [],
    };

    render(
      <QuestionPanel
        question={question}
        field={missingField}
        dossier={[missingField]}
        questionNumber={2}
        onAnswer={vi.fn()}
        onLeaveUnresolved={vi.fn()}
        onOpenSource={vi.fn()}
      />,
    );

    expect(
      screen.getByText(/neither document names an importer/i),
    ).toBeInTheDocument();
  });

  it("renders prototype question for rated-power unverified", () => {
    const question: Question = { fieldKey: "rated-power", shape: "unverified" };
    const unverifiedField: DossierField = {
      key: "rated-power",
      label: "Rated power consumption",
      group: "Electrical and Physical Information",
      tier: "essential",
      valueKind: "scalar",
      status: "unverified",
      originalValue: "2200 W",
      normalizedValue: "2200 W",
      markers: [],
      evidence: [],
      rejectedCandidates: [
        {
          fieldKey: "rated-power",
          value: "2200 W",
          citation: {
            documentId: "supplier-spec",
            page: 3,
            quote: "2200 W",
          },
          rejectionReason: "Quote not found on cited page.",
        },
      ],
      conflictCandidates: [],
      adjudicatedLosers: [],
      resolutionHistory: [],
    };

    render(
      <QuestionPanel
        question={question}
        field={unverifiedField}
        dossier={[unverifiedField]}
        questionNumber={3}
        onAnswer={vi.fn()}
        onLeaveUnresolved={vi.fn()}
        onOpenSource={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("heading", {
        name: /citation could not be located in the source/i,
      }),
    ).toBeInTheDocument();
  });

  it("passes surroundingWindow when conflict View source is clicked", async () => {
    const user = userEvent.setup();
    const onOpenSource = vi.fn();
    const question: Question = { fieldKey: "capacity", shape: "conflict" };
    const conflictField = field({
      conflictCandidates: [
        {
          value: "1.5 L",
          normalizedValue: "1.5 L",
          citation: {
            documentId: "supplier-spec",
            page: 1,
            quote: "Capacity: 1.5 L",
            surroundingWindow: "...Capacity: 1.5 L...",
          } as import("@/domain/types.js").Evidence,
          source: "document",
        },
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
    });

    render(
      <QuestionPanel
        question={question}
        field={conflictField}
        dossier={[conflictField]}
        questionNumber={1}
        onAnswer={vi.fn()}
        onLeaveUnresolved={vi.fn()}
        onOpenSource={onOpenSource}
      />,
    );

    const viewSourceButtons = screen.getAllByRole("button", {
      name: /view source/i,
    });
    await user.click(viewSourceButtons[0]!);

    expect(onOpenSource).toHaveBeenCalledWith(
      expect.objectContaining({
        surroundingWindow: "...Capacity: 1.5 L...",
      }),
      "Capacity",
    );
  });

  it("renders all conflict candidates as candidate cards", () => {
    const question: Question = { fieldKey: "capacity", shape: "conflict" };

    render(
      <QuestionPanel
        question={question}
        field={field()}
        dossier={[field()]}
        questionNumber={1}
        onAnswer={vi.fn()}
        onLeaveUnresolved={vi.fn()}
        onOpenSource={vi.fn()}
      />,
    );

    expect(screen.getByText("1.5 L")).toBeInTheDocument();
    expect(screen.getByText("1.7 L")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /use 1\.5 l/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /use 1\.7 l/i }),
    ).toBeInTheDocument();
  });

  it("dispatches provide-answer when missing question is submitted with text", async () => {
    const user = userEvent.setup();
    const onAnswer = vi.fn();
    const question: Question = { fieldKey: "importer-contact", shape: "missing" };
    const missingField: DossierField = {
      key: "importer-contact",
      label: "Importer or responsible-party contact",
      group: "Identity and Responsibility",
      tier: "essential",
      valueKind: "prose",
      status: "missing",
      originalValue: null,
      normalizedValue: null,
      markers: [],
      evidence: [],
      rejectedCandidates: [],
      conflictCandidates: [],
      adjudicatedLosers: [],
      resolutionHistory: [],
    };

    render(
      <QuestionPanel
        question={question}
        field={missingField}
        dossier={[missingField]}
        questionNumber={2}
        onAnswer={onAnswer}
        onLeaveUnresolved={vi.fn()}
        onOpenSource={vi.fn()}
      />,
    );

    await user.type(
      screen.getByRole("textbox", { name: /your answer/i }),
      "Acme Imports Ltd, contact@acme.example",
    );
    await user.click(screen.getByRole("button", { name: /submit answer/i }));

    expect(onAnswer).toHaveBeenCalledWith({
      type: "provide-answer",
      fieldKey: "importer-contact",
      value: "Acme Imports Ltd, contact@acme.example",
    });
  });

  it("dispatches declare-unavailable when missing question is submitted empty", async () => {
    const user = userEvent.setup();
    const onAnswer = vi.fn();
    const question: Question = { fieldKey: "importer-contact", shape: "missing" };
    const missingField: DossierField = {
      key: "importer-contact",
      label: "Importer or responsible-party contact",
      group: "Identity and Responsibility",
      tier: "essential",
      valueKind: "prose",
      status: "missing",
      originalValue: null,
      normalizedValue: null,
      markers: [],
      evidence: [],
      rejectedCandidates: [],
      conflictCandidates: [],
      adjudicatedLosers: [],
      resolutionHistory: [],
    };

    render(
      <QuestionPanel
        question={question}
        field={missingField}
        dossier={[missingField]}
        questionNumber={2}
        onAnswer={onAnswer}
        onLeaveUnresolved={vi.fn()}
        onOpenSource={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: /submit answer/i }));

    expect(onAnswer).toHaveBeenCalledWith({
      type: "declare-unavailable",
      fieldKey: "importer-contact",
    });
    expect(onAnswer).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: "provide-answer" }),
    );
  });
});
