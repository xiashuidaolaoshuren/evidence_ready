// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppChrome } from "./AppChrome";
import { SESSION_PERSISTENCE_WARNING } from "@/state/session";

describe("AppChrome", () => {
  afterEach(() => {
    cleanup();
  });

  it("omits Restart session before intake and shows it after intake", async () => {
    const user = userEvent.setup();
    const onRestart = vi.fn();

    const { rerender } = render(
      <AppChrome postIntake={false} onRestart={onRestart}>
        <p>Intake content</p>
      </AppChrome>,
    );

    expect(
      screen.queryByRole("button", { name: /restart session/i }),
    ).not.toBeInTheDocument();

    rerender(
      <AppChrome postIntake mode="recorded" onRestart={onRestart}>
        <p>Post-intake content</p>
      </AppChrome>,
    );

    await user.click(screen.getByRole("button", { name: /restart session/i }));
    expect(onRestart).toHaveBeenCalledOnce();
  });

  it("shows SESSION_PERSISTENCE_WARNING when sessionPersistenceWarning is set", () => {
    render(
      <AppChrome sessionPersistenceWarning>
        <p>Content</p>
      </AppChrome>,
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      SESSION_PERSISTENCE_WARNING,
    );
  });
});
