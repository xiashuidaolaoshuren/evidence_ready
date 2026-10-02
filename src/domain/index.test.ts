import { describe, expect, it } from "vitest";
import {
  applyEvent,
  assessCoverage,
  authoringReadiness,
  captureWindow,
  essentialKeys,
  extractionResponseSchema,
  FIELD_STATUSES,
  KETTLE_FIELDS,
  nextQuestion,
  normalizeValue,
  parseAnswer,
  proposalSchema,
  READINESS_VERDICTS,
  reconcileCandidates,
  shouldPause,
  SOFT_CAP,
  verifyCitation,
  extractionPrompt,
  interpretPrompt,
} from "./index";

describe("domain barrel exports", () => {
  it("re-exports the public surface", () => {
    expect(KETTLE_FIELDS).toHaveLength(15);
    expect(essentialKeys()).toHaveLength(9);
    expect(extractionResponseSchema).toBeDefined();
    expect(proposalSchema).toBeDefined();
    expect(FIELD_STATUSES).toHaveLength(5);
    expect(READINESS_VERDICTS).toEqual(["ready", "needs-review"]);
    expect(SOFT_CAP).toBe(5);
    expect(verifyCitation).toBeTypeOf("function");
    expect(captureWindow).toBeTypeOf("function");
    expect(normalizeValue).toBeTypeOf("function");
    expect(reconcileCandidates).toBeTypeOf("function");
    expect(assessCoverage).toBeTypeOf("function");
    expect(nextQuestion).toBeTypeOf("function");
    expect(shouldPause).toBeTypeOf("function");
    expect(parseAnswer).toBeTypeOf("function");
    expect(applyEvent).toBeTypeOf("function");
    expect(authoringReadiness).toBeTypeOf("function");
    expect(extractionPrompt).toBeTypeOf("function");
    expect(interpretPrompt).toBeTypeOf("function");
  });
});
