const RETRY_ERROR_CODES = new Set([
  "rate-limited",
  "model-unavailable",
  "malformed",
  "extraction-timeout",
  "internal-error",
]);

const USE_RECORDED_ERROR_CODES = new Set([
  "auth",
  "missing-key",
  "out-of-credits",
  "model-not-found",
  "model-rejected",
]);

const BACK_TO_INTAKE_ERROR_CODES = new Set([
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
]);

export type ErrorRecoveryAction = "retry" | "use-recorded" | "back-to-intake";

export function errorRecoveryAction(code: string): ErrorRecoveryAction {
  if (RETRY_ERROR_CODES.has(code)) {
    return "retry";
  }
  if (USE_RECORDED_ERROR_CODES.has(code)) {
    return "use-recorded";
  }
  if (BACK_TO_INTAKE_ERROR_CODES.has(code)) {
    return "back-to-intake";
  }
  return "back-to-intake";
}
