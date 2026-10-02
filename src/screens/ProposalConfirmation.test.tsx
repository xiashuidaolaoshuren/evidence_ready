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
});
