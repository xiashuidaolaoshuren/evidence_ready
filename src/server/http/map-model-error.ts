import "server-only";

import { ModelError } from "../model";
import { jsonError } from "./json-error";

function statusForModelError(code: ModelError["code"]): number {
  switch (code) {
    case "rate-limited":
      return 429;
    case "out-of-credits":
      return 402;
    case "auth":
      return 401;
    case "missing-key":
      return 400;
    case "model-blocked":
      return 403;
    case "model-not-found":
      return 404;
    case "model-rejected":
    case "malformed":
    case "text-too-large":
      return 400;
    case "model-unavailable":
      return 503;
    default:
      return 400;
  }
}

export function mapModelError(error: ModelError): Response {
  return jsonError(
    error.code,
    error.message,
    {
      envVar: error.envVar,
      ...(error.retryAfterSeconds !== undefined
        ? { retryAfterSeconds: error.retryAfterSeconds }
        : {}),
    },
    statusForModelError(error.code),
  );
}
