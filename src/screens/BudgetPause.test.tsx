// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BudgetPause } from "./BudgetPause";

describe("BudgetPause", () => {
  afterEach(() => {
    cleanup();
  });

  it("calls onContinue and onFinish from the budget pause dialog", async () => {
    const user = userEvent.setup();
    const onContinue = vi.fn();
    const onFinish = vi.fn();

    render(
      <BudgetPause open onContinue={onContinue} onFinish={onFinish} />,
    );

    await user.click(
      screen.getByRole("button", { name: /continue the interview/i }),
    );
    await user.click(
      screen.getByRole("button", { name: /finish and view report/i }),
    );

    expect(onContinue).toHaveBeenCalledOnce();
    expect(onFinish).toHaveBeenCalledOnce();
  });

  it("ignores Escape and keeps the budget pause open", async () => {
    const user = userEvent.setup();
    const onContinue = vi.fn();
    const onFinish = vi.fn();

    render(
      <BudgetPause open onContinue={onContinue} onFinish={onFinish} />,
    );

    await user.keyboard("{Escape}");

    expect(onContinue).not.toHaveBeenCalled();
    expect(onFinish).not.toHaveBeenCalled();
    expect(
      screen.getByRole("heading", { name: /five questions asked/i }),
    ).toBeInTheDocument();
  });

  it("keeps Tab focus inside the budget pause dialog", async () => {
    const user = userEvent.setup();

    render(
      <>
        <button type="button">Behind page</button>
        <BudgetPause open onContinue={vi.fn()} onFinish={vi.fn()} />
      </>,
    );

    const finishButton = screen.getByRole("button", {
      name: /finish and view report/i,
    });
    finishButton.focus();
    await user.tab();
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: /continue the interview/i }),
    );
    expect(document.activeElement).not.toBe(
      screen.getByRole("button", { name: /behind page/i }),
    );
  });
});
