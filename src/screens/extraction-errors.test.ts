import { describe, expect, it } from "vitest";
import { errorRecoveryAction } from "./extraction-errors";

describe("errorRecoveryAction", () => {
  it("maps every §4.4 recovery code to its action", () => {
    const retry = [
      "rate-limited",
      "model-unavailable",
      "malformed",
      "extraction-timeout",
      "internal-error",
    ] as const;
    const useRecorded = [
      "auth",
      "missing-key",
      "out-of-credits",
      "model-not-found",
      "model-rejected",
    ] as const;
    const backToIntake = [
      "model-blocked",
      "text-too-large",
      "live-unavailable",
      "encrypted",
      "image-only",
      "empty",
      "unsupported",
      "corrupt",
      "invalid-intake",
      "payload-too-large",
      "all-sources-failed",
    ] as const;

    for (const code of retry) {
      expect(errorRecoveryAction(code)).toBe("retry");
    }
    for (const code of useRecorded) {
      expect(errorRecoveryAction(code)).toBe("use-recorded");
    }
    for (const code of backToIntake) {
      expect(errorRecoveryAction(code)).toBe("back-to-intake");
    }
  });

  it("returns back-to-intake for codes outside the closed table", () => {
    expect(errorRecoveryAction("network")).toBe("back-to-intake");
    expect(errorRecoveryAction("gemini-unavailable")).toBe("back-to-intake");
    expect(errorRecoveryAction("some-new-code")).toBe("back-to-intake");
  });
});
