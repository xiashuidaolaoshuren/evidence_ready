export type ModelFailureCode =
  | "rate-limited"
  | "out-of-credits"
  | "auth"
  | "model-blocked"
  | "model-not-found"
  | "text-too-large"
  | "model-unavailable"
  | "model-rejected";

export interface ModelFailure {
  code: ModelFailureCode;
  message: string;
  retryAfterSeconds?: number;
}

export interface ClassifyModelFailureInput {
  status?: number;
  errorType?: string;
  retryAfterHeader?: string;
  network?: boolean;
}

const RATE_LIMITED_MESSAGE =
  "The model is rate limiting requests. Wait, then retry.";
const OUT_OF_CREDITS_MESSAGE =
  "The OpenRouter account has no credits left. Recorded extraction still works.";
const AUTH_MESSAGE = "The OpenRouter API key was rejected.";
const MODEL_BLOCKED_MESSAGE = "The model provider blocked this request.";
const MODEL_NOT_FOUND_MESSAGE = "The configured model is not available.";
const TEXT_TOO_LARGE_MESSAGE =
  "These documents are too long for one extraction. Submit fewer or shorter documents.";
const MODEL_UNAVAILABLE_MESSAGE =
  "The extraction model is temporarily unavailable.";
const MODEL_UNREACHABLE_MESSAGE = "The model could not be reached.";
const MODEL_REJECTED_MESSAGE =
  "The model rejected this request. Retrying will not help.";

const BLOCKED_ERROR_TYPES = new Set([
  "permission_denied",
  "content_policy_violation",
  "refusal",
]);

const TEXT_TOO_LARGE_ERROR_TYPES = new Set([
  "context_length_exceeded",
  "string_too_long",
]);

const UNAVAILABLE_ERROR_TYPES = new Set([
  "provider_overloaded",
  "provider_unavailable",
  "timeout",
  "server",
  "unmapped",
]);

const REJECTED_ERROR_TYPES = new Set([
  "invalid_request",
  "invalid_prompt",
  "precondition_failed",
  "unprocessable",
  "max_tokens_exceeded",
  "token_limit_exceeded",
  "payload_too_large",
]);

function parseRetryAfterSeconds(header: string | undefined): number | undefined {
  if (header === undefined) return undefined;
  const parsed = Number.parseInt(header, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  return Math.min(parsed, 120);
}

function withRateLimitWait(
  failure: ModelFailure,
  retryAfterHeader?: string,
): ModelFailure {
  if (failure.code !== "rate-limited") return failure;
  const retryAfterSeconds = parseRetryAfterSeconds(retryAfterHeader);
  if (retryAfterSeconds === undefined) return failure;
  return { ...failure, retryAfterSeconds };
}

function classifyByErrorType(errorType: string): ModelFailure | null {
  if (errorType === "rate_limit_exceeded") {
    return { code: "rate-limited", message: RATE_LIMITED_MESSAGE };
  }
  if (errorType === "payment_required") {
    return { code: "out-of-credits", message: OUT_OF_CREDITS_MESSAGE };
  }
  if (errorType === "authentication") {
    return { code: "auth", message: AUTH_MESSAGE };
  }
  if (BLOCKED_ERROR_TYPES.has(errorType)) {
    return { code: "model-blocked", message: MODEL_BLOCKED_MESSAGE };
  }
  if (errorType === "not_found") {
    return { code: "model-not-found", message: MODEL_NOT_FOUND_MESSAGE };
  }
  if (TEXT_TOO_LARGE_ERROR_TYPES.has(errorType)) {
    return { code: "text-too-large", message: TEXT_TOO_LARGE_MESSAGE };
  }
  if (UNAVAILABLE_ERROR_TYPES.has(errorType)) {
    return { code: "model-unavailable", message: MODEL_UNAVAILABLE_MESSAGE };
  }
  if (REJECTED_ERROR_TYPES.has(errorType)) {
    return { code: "model-rejected", message: MODEL_REJECTED_MESSAGE };
  }
  return null;
}

function classifyByStatus(status: number): ModelFailure {
  if (status === 429) {
    return { code: "rate-limited", message: RATE_LIMITED_MESSAGE };
  }
  if (status === 402) {
    return { code: "out-of-credits", message: OUT_OF_CREDITS_MESSAGE };
  }
  if (status === 401) {
    return { code: "auth", message: AUTH_MESSAGE };
  }
  if (status === 403) {
    return { code: "model-blocked", message: MODEL_BLOCKED_MESSAGE };
  }
  if (status === 404) {
    return { code: "model-not-found", message: MODEL_NOT_FOUND_MESSAGE };
  }
  if (
    status === 408 ||
    status === 502 ||
    status === 503 ||
    status === 504 ||
    status >= 500
  ) {
    return { code: "model-unavailable", message: MODEL_UNAVAILABLE_MESSAGE };
  }
  if (status === 400 || status === 412) {
    return { code: "model-rejected", message: MODEL_REJECTED_MESSAGE };
  }
  return { code: "model-unavailable", message: MODEL_UNAVAILABLE_MESSAGE };
}

export function classifyModelFailure(
  input: ClassifyModelFailureInput,
): ModelFailure {
  if (input.network) {
    return {
      code: "model-unavailable",
      message: MODEL_UNREACHABLE_MESSAGE,
    };
  }

  const trimmedType = input.errorType?.trim();
  if (trimmedType) {
    const byType = classifyByErrorType(trimmedType);
    if (byType) {
      return withRateLimitWait(byType, input.retryAfterHeader);
    }
  }

  if (input.status !== undefined) {
    return withRateLimitWait(classifyByStatus(input.status), input.retryAfterHeader);
  }

  return { code: "model-unavailable", message: MODEL_UNAVAILABLE_MESSAGE };
}
