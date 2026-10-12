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
});
