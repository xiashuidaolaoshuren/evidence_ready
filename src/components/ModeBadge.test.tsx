// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ModeBadge } from "./ModeBadge";

describe("ModeBadge", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows distinct labels for recorded and live modes", () => {
    const { rerender } = render(<ModeBadge mode="recorded" />);
    expect(screen.getByText("Recorded extraction")).toBeInTheDocument();

    rerender(<ModeBadge mode="live" />);
    expect(screen.getByText("Live extraction")).toBeInTheDocument();
  });
});
