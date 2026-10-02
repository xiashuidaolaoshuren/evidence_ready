import { describe, expect, it } from "vitest";
import type { Citation } from "./types";
import { WINDOW_RADIUS, captureWindow, verifyCitation } from "./verify";

describe("captureWindow window", () => {
  it("returns a window containing the quote with radius chars on each side when available", () => {
    const page = "A".repeat(200) + "TARGET" + "B".repeat(200);
    const quote = "TARGET";
    const radius = 120;
    const window = captureWindow(quote, page, radius);
    expect(window).toBe("A".repeat(120) + "TARGET" + "B".repeat(120));
  });

  it("clamps to page start when quote is near the beginning", () => {
    const page = "TARGET" + "B".repeat(300);
    const quote = "TARGET";
    const radius = 120;
    const window = captureWindow(quote, page, radius);
    expect(window).toBe("TARGET" + "B".repeat(120));
  });

  it("clamps to page end when quote is near the end", () => {
    const page = "A".repeat(300) + "TARGET";
    const quote = "TARGET";
    const radius = 120;
    const window = captureWindow(quote, page, radius);
    expect(window).toBe("A".repeat(120) + "TARGET");
  });

  it("exports WINDOW_RADIUS equal to 120 and uses it as the default radius", () => {
    expect(WINDOW_RADIUS).toBe(120);
    const page = "A".repeat(200) + "TARGET" + "B".repeat(200);
    const quote = "TARGET";
    expect(captureWindow(quote, page)).toBe(captureWindow(quote, page, 120));
  });

  it("finds the quote after whitespace normalization and slices original text", () => {
    const page = "prefix text   the   quick   brown   fox   suffix text";
    const quote = "the quick brown fox";
    const radius = 5;
    const window = captureWindow(quote, page, radius);
    expect(window).toBe("xt   the   quick   brown   fox   su");
  });
});

describe("verifyCitation verify", () => {
  const citation: Citation = {
    documentId: "doc-1",
    page: 3,
    quote: "TARGET",
  };

  it("returns Evidence with citation fields and surroundingWindow when the quote is present", () => {
    const page = "A".repeat(200) + "TARGET" + "B".repeat(200);
    const result = verifyCitation(citation, page);
    expect(result).toEqual({
      documentId: "doc-1",
      page: 3,
      quote: "TARGET",
      surroundingWindow: "A".repeat(120) + "TARGET" + "B".repeat(120),
    });
  });

  it("returns null when the quote is absent from the page", () => {
    const page = "some unrelated text here";
    const result = verifyCitation(citation, page);
    expect(result).toBeNull();
  });

  it("matches despite whitespace-only differences between quote and page", () => {
    const wsCitation: Citation = {
      documentId: "doc-2",
      page: 1,
      quote: "the quick brown fox",
    };
    const page = "prefix   the   quick   brown   fox   suffix";
    const result = verifyCitation(wsCitation, page);
    expect(result).not.toBeNull();
    expect(result?.quote).toBe("the quick brown fox");
    expect(result?.surroundingWindow).toBe(captureWindow(wsCitation.quote, page));
  });

  it("does not case-fold: differing case yields null", () => {
    const lowerCitation: Citation = {
      documentId: "doc-3",
      page: 1,
      quote: "target",
    };
    const page = "TARGET";
    const result = verifyCitation(lowerCitation, page);
    expect(result).toBeNull();
  });

  it("echoes the input citation fields on the returned Evidence", () => {
    const page = "TARGET";
    const result = verifyCitation(citation, page);
    expect(result?.documentId).toBe("doc-1");
    expect(result?.page).toBe(3);
    expect(result?.quote).toBe("TARGET");
  });

  it("returns null for an empty quote", () => {
    const result = verifyCitation(
      { documentId: "doc-1", page: 1, quote: "" },
      "any page text",
    );
    expect(result).toBeNull();
  });

  it("returns null for a whitespace-only quote", () => {
    const result = verifyCitation(
      { documentId: "doc-1", page: 1, quote: "   " },
      "any page text",
    );
    expect(result).toBeNull();
  });

  it("matches an ASCII-space quote against NBSP page text and captures a surrounding window", () => {
    const nbspCitation: Citation = {
      documentId: "doc-4",
      page: 1,
      quote: "a b",
    };
    const page = "prefix a\u00a0b suffix";
    const result = verifyCitation(nbspCitation, page);
    expect(result).not.toBeNull();
    expect(result?.surroundingWindow.length).toBeGreaterThan(0);
    expect(result?.surroundingWindow).toContain("a");
    expect(result?.surroundingWindow).toContain("b");
  });
});
