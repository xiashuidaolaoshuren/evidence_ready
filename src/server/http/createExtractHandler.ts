import "server-only";

import { z } from "zod";
import { validateIntakeUploads } from "../intake";
import { runExtraction, type PipelineUpload } from "../pipeline";
import { withContentLengthLimit } from "./content-length";
import { jsonError } from "./json-error";
import { mapExtractionStreamError } from "./map-stream-error";
import { extractionSseResponse } from "./sse";
import { DEFAULT_MAX_REQUEST_BYTES, type HttpDeps } from "./types";
import {
  isPublicDemo,
  liveExtractUnavailableResponse,
} from "./public-demo";
import { withErrorEnvelope } from "./withErrorEnvelope";

const fixtureExtractSchema = z.object({
  source: z.literal("fixture"),
  mode: z.enum(["recorded", "live"]),
});

function uploadIdFromFilename(filename: string, used: Set<string>): string {
  const base = filename.replace(/\.[^.]+$/, "");
  let id = base;
  let suffix = 2;
  while (used.has(id)) {
    id = `${base}-${suffix}`;
    suffix += 1;
  }
  used.add(id);
  return id;
}

async function pipelineUploadsFromForm(
  formData: FormData,
): Promise<PipelineUpload[]> {
  const uploads: PipelineUpload[] = [];
  const usedIds = new Set<string>();

  for (const entry of formData.getAll("files")) {
    if (typeof entry === "string") {
      continue;
    }
    const file = entry as File;
    const buffer = Buffer.from(await file.arrayBuffer());
    uploads.push({
      id: uploadIdFromFilename(file.name, usedIds),
      filename: file.name,
      mediaType: file.type || "application/octet-stream",
      buffer,
    });
  }

  return uploads;
}

export function createExtractHandler(deps: HttpDeps) {
  const run = deps.runExtractionFn ?? runExtraction;

  const handler = async (request: Request) => {
    const contentType = request.headers.get("content-type") ?? "";
    const publicDemo = isPublicDemo(deps);

    if (publicDemo && contentType.includes("multipart/form-data")) {
      return liveExtractUnavailableResponse();
    }

    if (contentType.includes("multipart/form-data")) {
      const uploads = await pipelineUploadsFromForm(await request.formData());
      const intakeError = validateIntakeUploads(uploads);
      if (intakeError) {
        return jsonError(intakeError.code, intakeError.message);
      }

      return extractionSseResponse(
        {
          mode: "live",
          uploads,
          transport: deps.transport,
          apiKey: deps.apiKey,
          signal: request.signal,
        },
        run,
        mapExtractionStreamError,
      );
    }

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
            signal: request.signal,
          },
          run,
          mapExtractionStreamError,
        );
      }

      if (publicDemo) {
        return liveExtractUnavailableResponse();
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
