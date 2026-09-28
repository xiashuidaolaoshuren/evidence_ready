import { describe, expect, it } from "vitest";
import { normalizeValue } from "./normalize";

describe("normalizeValue electrical scalar", () => {
  it("canonicalizes spaced voltage to '<n> V'", () => {
    expect(normalizeValue("230 V", "scalar")).toBe("230 V");
  });

  it("canonicalizes tight voltage '230V' to '230 V'", () => {
    expect(normalizeValue("230V", "scalar")).toBe("230 V");
  });

  it("canonicalizes spaced frequency to '<n> Hz'", () => {
    expect(normalizeValue("50 Hz", "scalar")).toBe("50 Hz");
  });

  it("canonicalizes tight frequency '50Hz' to '50 Hz'", () => {
    expect(normalizeValue("50Hz", "scalar")).toBe("50 Hz");
  });

  it("canonicalizes spaced power to '<n> W'", () => {
    expect(normalizeValue("2200 W", "scalar")).toBe("2200 W");
  });

  it("converts spaced kilowatts to watts (2.2 kW -> 2200 W)", () => {
    expect(normalizeValue("2.2 kW", "scalar")).toBe("2200 W");
  });

  it("converts tight kilowatts to watts (2.2kW -> 2200 W)", () => {
    expect(normalizeValue("2.2kW", "scalar")).toBe("2200 W");
  });

  it("returns trimmed string for non-parseable scalar", () => {
    expect(normalizeValue("  not a unit  ", "scalar")).toBe("not a unit");
  });
});

describe("normalizeValue capacity scalar", () => {
  it("canonicalizes spaced capacity '1.5 L' to '1.5 L'", () => {
    expect(normalizeValue("1.5 L", "scalar")).toBe("1.5 L");
  });

  it("canonicalizes tight capacity '1.5L' to '1.5 L'", () => {
    expect(normalizeValue("1.5L", "scalar")).toBe("1.5 L");
  });

  it("canonicalizes '1.5 litres' to '1.5 L'", () => {
    expect(normalizeValue("1.5 litres", "scalar")).toBe("1.5 L");
  });
});

describe("normalizeValue list", () => {
  it("trims and dedups array items preserving first-seen order", () => {
    expect(normalizeValue(["  a  ", "b", "a", "c", "b"], "list")).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("returns empty array unchanged", () => {
    expect(normalizeValue([], "list")).toEqual([]);
  });
});

describe("normalizeValue prose", () => {
  it("collapses whitespace runs to a single space and trims", () => {
    expect(normalizeValue("  hello   world\t\nnext  ", "prose")).toBe(
      "hello world next",
    );
  });
});
