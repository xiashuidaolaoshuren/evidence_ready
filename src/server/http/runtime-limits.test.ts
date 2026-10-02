import { describe, expect, it } from "vitest";
import { resolveRuntimeLimits } from "./runtime-limits";

describe("resolveRuntimeLimits", () => {
  it("defaults maxDuration to 120 and deadline to 110 seconds", () => {
    expect(resolveRuntimeLimits()).toEqual({
      maxDuration: 120,
      deadlineMs: 110_000,
    });
  });

  it("lowers both values for a smaller plan cap while keeping a 10 second buffer", () => {
    expect(resolveRuntimeLimits(100)).toEqual({
      maxDuration: 100,
      deadlineMs: 90_000,
    });
  });

  it("never lets maxDuration drop below deadline plus 10 seconds", () => {
    expect(resolveRuntimeLimits(15)).toEqual({
      maxDuration: 15,
      deadlineMs: 5_000,
    });
  });
});
