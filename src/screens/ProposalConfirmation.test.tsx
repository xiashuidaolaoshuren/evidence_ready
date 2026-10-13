// @vitest-environment jsdom
import userEvent from "@testing-library/user-event";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProposalConfirmation } from "./ProposalConfirmation";
import type { Proposal } from "@/domain/types";

describe("ProposalConfirmation", () => {
  afterEach(() => {
    cleanup();
  });

  it("dispatches apply-proposals when proposals are accepted", async () => {
    const user = userEvent.setup();
    const onAccept = vi.fn();
    const onDiscard = vi.fn();
    const proposals: Proposal[] = [
      {
        fieldKey: "importer-contact",
        proposedValue: "Acme Imports Ltd",
        answerText: "Acme Imports Ltd — rated power should be 2000 W",
      },
      {
        fieldKey: "rated-power",
        proposedValue: "2000 W",
        answerText: "Acme Imports Ltd — rated power should be 2000 W",
      },
    ];

    render(
      <ProposalConfirmation
        proposals={proposals}
        onAccept={onAccept}
        onDiscard={onDiscard}
      />,
    );

    expect(screen.getByText("Importer or responsible-party contact")).toBeInTheDocument();
    expect(screen.getByText("Rated power")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /write 2 proposals/i }),
    );

    expect(onAccept).toHaveBeenCalledWith(proposals);
    expect(onDiscard).not.toHaveBeenCalled();
  });

  it("calls onDiscard when Escape is pressed", async () => {
    const user = userEvent.setup();
    const onAccept = vi.fn();
    const onDiscard = vi.fn();
    const proposals: Proposal[] = [
      {
        fieldKey: "rated-power",
        proposedValue: "2000 W",
        answerText: "2000 W please",
      },
    ];

    render(
      <ProposalConfirmation
        proposals={proposals}
        onAccept={onAccept}
        onDiscard={onDiscard}
      />,
    );

    await user.keyboard("{Escape}");
    expect(onDiscard).toHaveBeenCalledOnce();
    expect(onAccept).not.toHaveBeenCalled();
  });

  it("keeps Tab focus inside the proposal dialog", async () => {
    const user = userEvent.setup();
    const proposals: Proposal[] = [
      {
        fieldKey: "rated-power",
        proposedValue: "2000 W",
        answerText: "2000 W please",
      },
    ];

    render(
      <>
        <button type="button">Behind page</button>
        <ProposalConfirmation
          proposals={proposals}
          onAccept={vi.fn()}
          onDiscard={vi.fn()}
        />
      </>,
    );

    const discardButton = screen.getByRole("button", { name: /discard all/i });
    discardButton.focus();
    await user.tab();
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: /write 1 proposal/i }),
    );
    expect(document.activeElement).not.toBe(
      screen.getByRole("button", { name: /behind page/i }),
    );
  });
});
