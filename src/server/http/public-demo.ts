import "server-only";

import { jsonError } from "./json-error";
import type { HttpDeps } from "./types";

export function isPublicDemo(deps: HttpDeps): boolean {
  if (deps.publicDemo !== undefined) {
    return deps.publicDemo;
  }
  return process.env.EVIDENCEREADY_PUBLIC_DEMO === "1";
}

export function liveExtractUnavailableResponse(): Response {
  return jsonError(
    "live-unavailable",
    "Live extraction is not available in this demo.",
    {},
    403,
  );
}

export function liveInterpretUnavailableResponse(): Response {
  return jsonError(
    "live-unavailable",
    "Answer interpretation is not available in this demo.",
    {},
    403,
  );
}
