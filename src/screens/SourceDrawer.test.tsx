// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SourceDrawer } from "./SourceDrawer";

describe("SourceDrawer", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows the passage and calls onClose when Close is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const passage = "Rated power: 2200 W on page 2 of the supplier specification.";

    render(
      <SourceDrawer
        open
        kind="Evidence"
        title="Rated power"
        meta="supplier-spec · page 2"
        passage={passage}
        quote="2200 W"
        note="Exact quote must appear on the cited page."
        onClose={onClose}
      />,
    );

    const drawer = screen.getByRole("complementary", { name: /source evidence/i });
    expect(drawer).toHaveTextContent(passage);
    expect(drawer).toHaveTextContent("2200 W");

    await user.click(screen.getByRole("button", { name: /close/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
