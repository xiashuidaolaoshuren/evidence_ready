import "server-only";

import { EXTRACTION_DEADLINE_MS } from "../../../server/pipeline.js";

export const DEFAULT_MAX_DURATION_SECONDS = 120;
const DEADLINE_BUFFER_SECONDS = 10;

export function resolveRuntimeLimits(
  planCapSeconds = DEFAULT_MAX_DURATION_SECONDS,
): {
  maxDuration: number;
  deadlineMs: number;
} {
  if (planCapSeconds === DEFAULT_MAX_DURATION_SECONDS) {
    return {
      maxDuration: DEFAULT_MAX_DURATION_SECONDS,
      deadlineMs: EXTRACTION_DEADLINE_MS,
    };
  }

  const deadlineSeconds = Math.max(0, planCapSeconds - DEADLINE_BUFFER_SECONDS);
  return {
    maxDuration: planCapSeconds,
    deadlineMs: deadlineSeconds * 1000,
  };
}
