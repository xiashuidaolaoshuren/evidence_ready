import "server-only";

import { z } from "zod";
import { runExtraction } from "../../../server/pipeline.js";
import { withContentLengthLimit } from "./content-length";
import { jsonError } from "./json-error";
import { mapExtractionStreamError } from "./map-stream-error";
import { extractionSseResponse } from "./sse";
import { DEFAULT_MAX_REQUEST_BYTES, type HttpDeps } from "./types";
import { withErrorEnvelope } from "./withErrorEnvelope";

const fixtureExtractSchema = z.object({
  source: z.literal("fixture"),
  mode: z.enum(["recorded", "live"]),
});

export function createExtractHandler(deps: HttpDeps) {
  const run = deps.runExtractionFn ?? runExtraction;

  const handler = async (request: Request) => {
    const contentType = request.headers.get("content-type") ?? "";

    if (!contentType.includes("application/json")) {
      return jsonError("invalid-intake", "Expected JSON or multipart upload.");
    }

    let raw: unknown;
    try {
      raw = await request.json();
    } catch (error) {
      if (error instanceof SyntaxError) {
        return jsonError("invalid-request", "Invalid extract request body.");
      }
      throw error;
    }

    try {
      const body = fixtureExtractSchema.parse(raw);

      if (body.mode === "recorded") {
        return extractionSseResponse(
          {
            mode: "recorded",
            fixtureDir: deps.fixtureDir,
          },
          run,
          mapExtractionStreamError,
        );
      }

      return jsonError("invalid-intake", "Expected JSON or multipart upload.");
    } catch (error) {
      if (error instanceof z.ZodError) {
        return jsonError("invalid-request", "Invalid extract request body.");
      }
      throw error;
    }
  };

  return withErrorEnvelope(
    withContentLengthLimit(
      handler,
      deps.maxRequestBytes ?? DEFAULT_MAX_REQUEST_BYTES,
    ),
  );
}
