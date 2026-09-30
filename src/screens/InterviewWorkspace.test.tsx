// @vitest-environment jsdom
import userEvent from "@testing-library/user-event";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InterviewWorkspace } from "./InterviewWorkspace";
import { interpretAnswer } from "@/api";
import type { DossierField, InterviewState } from "@/domain/types";

vi.mock("@/api.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/api.js")>();
  return {
    ...actual,
    interpretAnswer: vi.fn(),
  };
});

function dossierField(
  key: string,
  status: DossierField["status"],
  overrides: Partial<DossierField> = {},
): DossierField {
  return {
    key,
    label: key,
    group: "Identity and Responsibility",
    tier: "essential",
    valueKind: "scalar",
    status,
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

const interviewBase: InterviewState = {
  phase: "interview",
  currentQuestionFieldKey: "importer-contact",
  askedFieldKeys: ["capacity"],
  answeredFieldKeys: ["capacity"],
  declaredUnavailableFieldKeys: [],
  questionCount: 1,
  continuePastBudget: false,
  completionReason: null,
};

describe("InterviewWorkspace interpretation", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("calls interpret and opens proposal confirmation for multi-field importer answers", async () => {
    const user = userEvent.setup();
    const onAnswer = vi.fn();
    const proposals = [
      {
        fieldKey: "importer-contact",
        proposedValue: "Acme Imports GmbH",
        answerText: "Acme Imports GmbH — rated power should be 2200 W",
      },
      {
        fieldKey: "rated-power",
        proposedValue: "2200 W",
        answerText: "Acme Imports GmbH — rated power should be 2200 W",
      },
    ];
    vi.mocked(interpretAnswer).mockResolvedValue({ proposals });

    const dossier: DossierField[] = [
      dossierField("capacity", "confirmed", {
        label: "Capacity",
        originalValue: "1.5 L",
        normalizedValue: "1.5 L",
        markers: ["adjudicated"],
      }),
      dossierField("importer-contact", "missing", {
        label: "Importer or responsible-party contact",
        valueKind: "prose",
      }),
      dossierField("rated-power", "unverified", {
        label: "Rated power",
        group: "Electrical and Physical Information",
        originalValue: "2200 W",
        normalizedValue: "2200 W",
      }),
    ];

    render(
      <InterviewWorkspace
        dossier={dossier}
        interview={interviewBase}
        onAnswer={onAnswer}
        onLeaveUnresolved={vi.fn()}
        onContinuePastBudget={vi.fn()}
        onContinueSupporting={vi.fn()}
        onFinish={vi.fn()}
      />,
    );

    await user.type(
      screen.getByRole("textbox", { name: /your answer/i }),
      "Acme Imports GmbH — rated power should be 2200 W",
    );
    await user.click(screen.getByRole("button", { name: /submit answer/i }));

    await waitFor(() => {
      expect(interpretAnswer).toHaveBeenCalledWith(
        "importer-contact",
        "Acme Imports GmbH — rated power should be 2200 W",
        dossier,
        expect.any(AbortSignal),
      );
    });

    expect(
      screen.getByRole("dialog", {
        name: /the model interpreted your answer into proposed updates/i,
      }),
    ).toBeInTheDocument();
    expect(onAnswer).not.toHaveBeenCalled();
  });

  it("aborts interpretation when the workspace unmounts", async () => {
    let capturedSignal: AbortSignal | undefined;
    vi.mocked(interpretAnswer).mockImplementation(
      (_fieldKey, _answerText, _dossier, signal) => {
        capturedSignal = signal;
        return new Promise(() => {});
      },
    );

    const { unmount } = render(
      <InterviewWorkspace
        dossier={[
          dossierField("capacity", "confirmed"),
          dossierField("importer-contact", "missing", {
            label: "Importer or responsible-party contact",
            valueKind: "prose",
          }),
        ]}
        interview={interviewBase}
        onAnswer={vi.fn()}
        onLeaveUnresolved={vi.fn()}
        onContinuePastBudget={vi.fn()}
        onContinueSupporting={vi.fn()}
        onFinish={vi.fn()}
      />,
    );

    const user = userEvent.setup();
    await user.type(
      screen.getByRole("textbox", { name: /your answer/i }),
      "Acme Imports GmbH — rated power should be 2200 W",
    );
    await user.click(screen.getByRole("button", { name: /submit answer/i }));

    await waitFor(() => {
      expect(capturedSignal).toBeDefined();
    });

    unmount();
    expect(capturedSignal?.aborted).toBe(true);
  });
});

describe("InterviewWorkspace public demo", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("shows one-field guidance and skips interpret for multi-field answers", async () => {
    const user = userEvent.setup();
    const onAnswer = vi.fn();

    render(
      <InterviewWorkspace
        publicDemo
        dossier={[
          dossierField("capacity", "confirmed"),
          dossierField("importer-contact", "missing", {
            label: "Importer or responsible-party contact",
            valueKind: "prose",
          }),
        ]}
        interview={interviewBase}
        onAnswer={onAnswer}
        onLeaveUnresolved={vi.fn()}
        onContinuePastBudget={vi.fn()}
        onContinueSupporting={vi.fn()}
        onFinish={vi.fn()}
      />,
    );

    await user.type(
      screen.getByRole("textbox", { name: /your answer/i }),
      "Acme Imports GmbH — rated power should be 2200 W",
    );
    await user.click(screen.getByRole("button", { name: /submit answer/i }));

    expect(interpretAnswer).not.toHaveBeenCalled();
    expect(
      screen.getByText(/this demo takes one field at a time/i),
    ).toBeInTheDocument();
    expect(onAnswer).not.toHaveBeenCalled();
  });

  it("applies a direct answer in public demo", async () => {
    const user = userEvent.setup();
    const onAnswer = vi.fn();

    render(
      <InterviewWorkspace
        publicDemo
        dossier={[
          dossierField("capacity", "confirmed"),
          dossierField("importer-contact", "missing", {
            label: "Importer or responsible-party contact",
            valueKind: "prose",
          }),
        ]}
        interview={interviewBase}
        onAnswer={onAnswer}
        onLeaveUnresolved={vi.fn()}
        onContinuePastBudget={vi.fn()}
        onContinueSupporting={vi.fn()}
        onFinish={vi.fn()}
      />,
    );

    await user.type(
      screen.getByRole("textbox", { name: /your answer/i }),
      "Acme Imports GmbH",
    );
    await user.click(screen.getByRole("button", { name: /submit answer/i }));

    expect(interpretAnswer).not.toHaveBeenCalled();
    expect(onAnswer).toHaveBeenCalledWith({
      type: "provide-answer",
      fieldKey: "importer-contact",
      value: "Acme Imports GmbH",
    });
  });

  it("shows the refresh note about drafts and unaccepted proposals", () => {
    render(
      <InterviewWorkspace
        dossier={[dossierField("capacity", "conflicting")]}
        interview={interviewBase}
        onAnswer={vi.fn()}
        onLeaveUnresolved={vi.fn()}
        onContinuePastBudget={vi.fn()}
        onContinueSupporting={vi.fn()}
        onFinish={vi.fn()}
      />,
    );

    expect(
      screen.getByText(
        /refresh keeps applied dossier changes and interview progress/i,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/does not keep an unfinished answer or an unaccepted proposal/i),
    ).toBeInTheDocument();
  });
});
