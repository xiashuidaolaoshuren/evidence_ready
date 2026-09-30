// @vitest-environment jsdom
import {
  act,
  cleanup,
  render,
  screen,
  waitFor,
  type RenderResult,
} from "@testing-library/react";
import type { ReactNode } from "react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { KETTLE_FIELDS } from "@/domain/fields";
import type { DossierField, InterviewState } from "@/domain/types";
import type { StoredSession } from "@/state/session";
import * as sessionModule from "@/state/session";
import * as api from "@/api";

import { useSyncExternalStore } from "react";

const replace = vi.fn();
const push = vi.fn();
let pathnameStore = "/";
const pathnameListeners = new Set<() => void>();

function subscribePathname(listener: () => void) {
  pathnameListeners.add(listener);
  return () => {
    pathnameListeners.delete(listener);
  };
}

function getPathnameSnapshot() {
  return pathnameStore;
}

function setPathnameStore(next: string) {
  pathnameStore = next;
  for (const listener of pathnameListeners) {
    listener();
  }
}

vi.mock("next/navigation", () => ({
  usePathname: () =>
    useSyncExternalStore(
      subscribePathname,
      getPathnameSnapshot,
      getPathnameSnapshot,
    ),
  useRouter: () => ({ replace, push }),
}));

vi.mock("@/api.js", () => ({
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
  interpretAnswer: vi.fn(),
}));

vi.mock("@/state/session.js", async (importOriginal) => {
  const actual = await importOriginal<typeof sessionModule>();
  return {
    ...actual,
    loadSession: vi.fn(),
    saveSession: vi.fn(() => ({ warned: false })),
    clearSession: vi.fn(),
  };
});

import { SessionGate, useSession } from "./SessionProvider";

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

function validInterviewSession(now: Date): StoredSession {
  return {
    version: 2,
    updatedAt: now.toISOString(),
    phase: "interview",
    dossier: fullKettleDossier(),
    rejected: [],
    mode: "recorded",
    counts: { extracted: 0, rejected: 0, conflicts: 0, missing: 15 },
    interview: sampleInterview(),
    excerpts: [],
  };
}

function PhaseProbe() {
  const { state } = useSession();
  return <div data-testid="phase">{state.phase}</div>;
}

function NoticeProbe() {
  const { sessionNotice } = useSession();
  return (
    <div data-testid="session-notice">{sessionNotice ?? "no-notice"}</div>
  );
}

describe("SessionGate restore", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  beforeEach(() => {
    setPathnameStore("/");
    replace.mockClear();
    push.mockClear();
  });

  it("restores a valid session once after mount without pushing history", async () => {
    const now = new Date("2026-09-20T12:00:00.000Z");
    const stored = validInterviewSession(now);
    vi.mocked(sessionModule.loadSession).mockReturnValue({
      session: stored,
      notice: null,
    });

    render(
      <SessionGate publicDemo={false}>
        <PhaseProbe />
      </SessionGate>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("phase")).toHaveTextContent("interview");
    });
    expect(screen.queryByTestId("session-gate-restoring")).not.toBeInTheDocument();

    expect(sessionModule.loadSession).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith("/interview");
    expect(push).not.toHaveBeenCalled();
  });

  it("lands at intake with a restore notice when the session cannot be resumed", async () => {
    const notice = "The saved session could not be restored.";
    vi.mocked(sessionModule.loadSession).mockReturnValue({
      session: null,
      notice,
    });

    render(
      <SessionGate publicDemo={false}>
        <PhaseProbe />
        <NoticeProbe />
      </SessionGate>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("phase")).toHaveTextContent("intake");
    });

    expect(screen.getByTestId("session-notice")).toHaveTextContent(notice);
    expect(replace).toHaveBeenCalledWith("/");
  });
});

function StartExtractButton() {
  const { handleStartBundled } = useSession();
  return (
    <button type="button" onClick={() => handleStartBundled("recorded")}>
      Start extract
    </button>
  );
}

describe("SessionProvider URL sync", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  beforeEach(() => {
    setPathnameStore("/");
    replace.mockClear();
    push.mockClear();
    vi.mocked(sessionModule.loadSession).mockReturnValue({
      session: null,
      notice: null,
    });
  });

  it("pushes the phase route after a user phase change once the gate has committed", async () => {
    const user = userEvent.setup();

    render(
      <SessionGate publicDemo={false}>
        <StartExtractButton />
      </SessionGate>,
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /start extract/i })).toBeInTheDocument();
    });

    push.mockClear();
    replace.mockClear();

    await user.click(screen.getByRole("button", { name: /start extract/i }));

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith("/extract");
    });
    expect(push).toHaveBeenCalledTimes(1);
  });

  it("does not push during restore when the URL already matches the restored phase", async () => {
    setPathnameStore("/interview");
    const now = new Date("2026-09-20T12:00:00.000Z");
    vi.mocked(sessionModule.loadSession).mockReturnValue({
      session: validInterviewSession(now),
      notice: null,
    });

    render(
      <SessionGate publicDemo={false}>
        <PhaseProbe />
      </SessionGate>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("phase")).toHaveTextContent("interview");
    });

    expect(push).not.toHaveBeenCalled();
    expect(replace).toHaveBeenCalledWith("/interview");
  });
});

function renderWithPathname(
  path: string,
  ui: ReactNode,
): RenderResult & { navigateTo: (nextPath: string) => void } {
  setPathnameStore(path);
  const view = render(<>{ui}</>);
  return {
    ...view,
    navigateTo: (nextPath: string) => {
      setPathnameStore(nextPath);
    },
  };
}

describe("SessionProvider pathname sync", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  beforeEach(() => {
    replace.mockClear();
    push.mockClear();
  });

  it("dispatches finish when interview phase sees /report", async () => {
    const now = new Date("2026-09-20T12:00:00.000Z");
    const stored = validInterviewSession(now);
    stored.dossier = stored.dossier.map((field) =>
      field.key === "capacity"
        ? {
            ...field,
            status: "user-provided" as const,
            originalValue: "1.7 L",
            normalizedValue: "1.7 L",
            markers: [],
          }
        : field,
    );
    stored.interview = {
      ...stored.interview,
      completionReason: "essentials-clear",
      answeredFieldKeys: ["capacity"],
    };
    vi.mocked(sessionModule.loadSession).mockReturnValue({
      session: stored,
      notice: null,
    });

    const view = renderWithPathname(
      "/interview",
      <SessionGate publicDemo={false}>
        <PhaseProbe />
      </SessionGate>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("phase")).toHaveTextContent("interview");
    });

    replace.mockClear();
    view.navigateTo("/report");

    await waitFor(() => {
      expect(screen.getByTestId("phase")).toHaveTextContent("report");
    });
  });

  it("replaces the URL when the pathname does not match and no history move applies", async () => {
    const now = new Date("2026-09-20T12:00:00.000Z");
    vi.mocked(sessionModule.loadSession).mockReturnValue({
      session: validInterviewSession(now),
      notice: null,
    });

    const view = renderWithPathname(
      "/interview",
      <SessionGate publicDemo={false}>
        <PhaseProbe />
      </SessionGate>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("phase")).toHaveTextContent("interview");
    });

    replace.mockClear();
    view.navigateTo("/extract");

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/interview");
    });
  });
});

function RestartButton() {
  const { handleRestart } = useSession();
  return (
    <button type="button" onClick={handleRestart}>
      Restart session
    </button>
  );
}

describe("SessionProvider cancellation", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  beforeEach(() => {
    setPathnameStore("/");
    replace.mockClear();
    push.mockClear();
    vi.mocked(sessionModule.loadSession).mockReturnValue({
      session: null,
      notice: null,
    });
  });

  it("aborts an in-flight extraction when restart is clicked", async () => {
    const user = userEvent.setup();
    let capturedSignal: AbortSignal | undefined;
    vi.mocked(api.extractFixture).mockImplementation(
      (_mode, _onEvent, signal) => {
        capturedSignal = signal;
        return new Promise(() => {});
      },
    );

    render(
      <SessionGate publicDemo={false}>
        <StartExtractButton />
        <RestartButton />
      </SessionGate>,
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /start extract/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /start extract/i }));

    await waitFor(() => {
      expect(api.extractFixture).toHaveBeenCalled();
      expect(capturedSignal).toBeDefined();
    });

    await user.click(screen.getByRole("button", { name: /restart session/i }));

    expect(capturedSignal?.aborted).toBe(true);
  });

  it("ignores a stale extraction completion after restart", async () => {
    const user = userEvent.setup();
    let resolveExtract!: (value: {
      mode: "recorded";
      dossier: DossierField[];
      rejected: [];
      coverage: "interview";
      counts: { extracted: number; rejected: number; conflicts: number; missing: number };
    }) => void;
    const extractPromise = new Promise<{
      mode: "recorded";
      dossier: DossierField[];
      rejected: [];
      coverage: "interview";
      counts: { extracted: number; rejected: number; conflicts: number; missing: number };
    }>((resolve) => {
      resolveExtract = resolve;
    });
    vi.mocked(api.extractFixture).mockReturnValue(extractPromise);

    function PhaseOrIntake() {
      const { state } = useSession();
      return <div data-testid="phase">{state.phase}</div>;
    }

    render(
      <SessionGate publicDemo={false}>
        <StartExtractButton />
        <RestartButton />
        <PhaseOrIntake />
      </SessionGate>,
    );

    await user.click(screen.getByRole("button", { name: /start extract/i }));
    await waitFor(() => {
      expect(screen.getByTestId("phase")).toHaveTextContent("extracting");
    });

    await user.click(screen.getByRole("button", { name: /restart session/i }));
    await waitFor(() => {
      expect(screen.getByTestId("phase")).toHaveTextContent("intake");
    });

    await act(async () => {
      resolveExtract({
        mode: "recorded",
        dossier: fullKettleDossier(),
        rejected: [],
        coverage: "interview",
        counts: { extracted: 1, rejected: 0, conflicts: 0, missing: 14 },
      });
      await extractPromise;
    });

    expect(screen.getByTestId("phase")).toHaveTextContent("intake");
  });
});
