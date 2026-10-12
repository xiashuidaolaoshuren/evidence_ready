// @vitest-environment jsdom
import {
  cleanup,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { useSyncExternalStore } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "./AppShell";
import { Intake } from "@/screens/Intake";
import * as sessionModule from "@/state/session";

const replace = vi.fn();

function subscribePathname(listener: () => void) {
  listener();
  return () => {};
}

vi.mock("next/navigation", () => ({
  usePathname: () =>
    useSyncExternalStore(subscribePathname, () => "/", () => "/"),
  useRouter: () => ({ replace, push: vi.fn() }),
}));

vi.mock("@/api.js", () => ({
  ApiError: class ApiError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
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
    loadSession: vi.fn(() => ({ session: null, notice: null })),
    saveSession: vi.fn(() => ({ warned: false })),
    clearSession: vi.fn(),
  };
});

import { SessionGate } from "@/state/SessionProvider";

describe("AppShell", () => {
  beforeEach(() => {
    replace.mockClear();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders the intake screen at the initial phase without Restart session", async () => {
    render(
      <SessionGate publicDemo={false}>
        <AppShell>
          <Intake onStartBundled={vi.fn()} onStartUpload={vi.fn()} />
        </AppShell>
      </SessionGate>,
    );

    await waitFor(() => {
      expect(
        screen.getByRole("heading", {
          name: /bundled example · ark-1500 electric kettle/i,
        }),
      ).toBeInTheDocument();
    });

    expect(
      screen.queryByRole("button", { name: /restart session/i }),
    ).not.toBeInTheDocument();
  });
});
