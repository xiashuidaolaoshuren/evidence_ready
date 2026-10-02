import "server-only";

import { ModelError } from "../../../server/model";
import { jsonError } from "./json-error";

export function mapModelError(error: ModelError): Response {
  if (error.code === "upstream") {
    return jsonError(
      "gemini-unavailable",
      "The extraction model is temporarily unavailable.",
      {},
      503,
    );
  }
  return jsonError(error.code, error.message, {
    envVar: error.envVar,
  });
}
