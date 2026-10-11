import "server-only";

import { z } from "zod";
import {
  AllSourcesFailedError,
  ExtractionTimeoutError,
  TextTooLargeError,
  type RunExtractionResult,
} from "../pipeline";
import { ModelError } from "../model";
import { PdfExtractError } from "../pdf";

export function mapExtractionStreamError(error: unknown): {
  code: string;
  message: string;
  envVar?: string;
  retryAfterSeconds?: number;
  failedSources?: RunExtractionResult["failedSources"];
} {
  if (error instanceof ModelError) {
    return {
      code: error.code,
      message: error.message,
      envVar: error.envVar,
      ...(error.retryAfterSeconds !== undefined
        ? { retryAfterSeconds: error.retryAfterSeconds }
        : {}),
    };
  }
  if (error instanceof ExtractionTimeoutError) {
    return {
      code: "extraction-timeout",
      message: error.message,
    };
  }
  if (error instanceof TextTooLargeError) {
    return {
      code: "text-too-large",
      message: error.message,
    };
  }
  if (error instanceof AllSourcesFailedError) {
    return {
      code: "all-sources-failed",
      message: error.message,
      failedSources: error.failedSources,
    };
  }
  if (error instanceof PdfExtractError) {
    return {
      code: error.code,
      message: error.message,
    };
  }
  if (error instanceof z.ZodError) {
    return {
      code: "invalid-request",
      message: "Invalid extract request body.",
    };
  }
  return {
    code: "internal-error",
    message: "Unexpected server error.",
  };
}
