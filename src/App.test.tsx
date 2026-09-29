// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import * as api from "./api";
import * as session from "./session";

vi.mock("./api.js", () => ({
  ApiError: class ApiError extends Error {
    code: string;
    envVar?: string;
    constructor(code: string, message: string, envVar?: string) {
      super(message);
      this.code = code;
      this.envVar = envVar;
    }
  },
  extractFixture: vi.fn(),
  extractUpload: vi.fn(),
}));

vi.mock("./session.js", async (importOriginal) => {
  const actual = await importOriginal<typeof session>();
  return {
    ...actual,
    saveSession: vi.fn(() => ({ warned: false })),
    loadSession: vi.fn(() => null),
    clearSession: vi.fn(),
  };
});

const mockExtractResponse = {
  mode: "recorded" as const,
  dossier: [
    {
      key: "product-name",
      label: "Product name",
      group: "Identity and Responsibility",
      tier: "essential" as const,
      valueKind: "scalar" as const,
      status: "confirmed" as const,
      originalValue: "Acme Rapid Kettle",
      normalizedValue: "Acme Rapid Kettle",
      markers: [],
      evidence: [],
      rejectedCandidates: [],
      conflictCandidates: [],
      adjudicatedLosers: [],
      resolutionHistory: [],
    },
  ],
  rejected: [],
  coverage: "interview" as const,
  counts: { extracted: 1, rejected: 0, conflicts: 0, missing: 0 },
};

describe("App extraction lifecycle", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("starts at intake even when a stored interview session exists", () => {
    vi.mocked(session.loadSession).mockReturnValue({
      dossier: mockExtractResponse.dossier,
      rejected: [],
      mode: "recorded",
      interview: {
        phase: "interview",
        currentQuestionFieldKey: "product-name",
        askedFieldKeys: ["product-name"],
        answeredFieldKeys: [],
        declaredUnavailableFieldKeys: [],
        questionCount: 1,
        continuePastBudget: false,
        completionReason: null,
      },
      excerpts: [],
    });

    render(<App />);

    expect(
      screen.getByRole("heading", {
        name: /know what your documents can prove before authoring begins/i,
      }),
    ).toBeInTheDocument();
    expect(session.clearSession).toHaveBeenCalled();
  });

  it("ignores a stale extraction completion after restart", async () => {
    const user = userEvent.setup();
    let resolveExtract!: (value: typeof mockExtractResponse) => void;
    const extractPromise = new Promise<typeof mockExtractResponse>((resolve) => {
      resolveExtract = resolve;
    });
    vi.mocked(api.extractFixture).mockReturnValue(extractPromise);

    render(<App />);

    await user.click(
      screen.getByRole("button", { name: /load the bundled example/i }),
    );
    expect(screen.getByText(/extracting and verifying the dossier/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /restart session/i }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /load the bundled example/i }),
      ).toBeInTheDocument();
    });

    await act(async () => {
      resolveExtract(mockExtractResponse);
      await extractPromise;
    });

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /load the bundled example/i }),
      ).toBeInTheDocument();
    });
  });

  it("shows a warning when session persistence falls back to memory", async () => {
    const user = userEvent.setup();
    vi.mocked(api.extractFixture).mockResolvedValue(mockExtractResponse);
    vi.mocked(session.saveSession).mockReturnValue({ warned: true });

    render(<App />);

    await user.click(
      screen.getByRole("button", { name: /load the bundled example/i }),
    );

    await waitFor(() => {
      expect(
        screen.getByText(session.SESSION_PERSISTENCE_WARNING),
      ).toBeInTheDocument();
    });
  });
});
