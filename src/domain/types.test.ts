import { describe, expect, it } from "vitest";
import {
  EXTRACTION_MODES,
  FIELD_STATUSES,
  FIELD_TIERS,
  PROVENANCE_MARKERS,
  VALUE_KINDS,
} from "./types";

describe("domain enumerated sets", () => {
  it("defines the five field statuses", () => {
    expect(FIELD_STATUSES).toEqual([
      "confirmed",
      "user-provided",
      "unverified",
      "conflicting",
      "missing",
    ]);
  });

  it("defines the two provenance markers", () => {
    expect(PROVENANCE_MARKERS).toEqual(["adjudicated", "declaredUnavailable"]);
  });

  it("defines the two field tiers", () => {
    expect(FIELD_TIERS).toEqual(["essential", "supporting"]);
  });

  it("defines the three value kinds", () => {
    expect(VALUE_KINDS).toEqual(["scalar", "list", "prose"]);
  });

  it("defines the two extraction modes", () => {
    expect(EXTRACTION_MODES).toEqual(["recorded", "live"]);
  });
});
