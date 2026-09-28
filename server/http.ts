import { readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { z } from "zod";
import { interpretPrompt } from "../src/domain/prompt.js";
import { dossierSchema } from "../src/domain/schemas.js";
import type { DossierField } from "../src/domain/types.js";
import {
  AllSourcesFailedError,
  runExtraction,
  type PipelineUpload,
  type RunExtractionInput,
  type RunExtractionResult,
} from "./pipeline.js";
import {
  ModelError,
  interpretAnswer as defaultInterpretAnswer,
  type ModelTransport,
} from "./model.js";
import {
  MAX_TOTAL_UPLOAD_BYTES,
  MAX_UPLOAD_COUNT,
  validateIntakeUploads,
} from "./intake.js";
import { PdfExtractError } from "./pdf.js";

export { MAX_TOTAL_UPLOAD_BYTES, MAX_UPLOAD_COUNT } from "./intake.js";

export const DEFAULT_MAX_REQUEST_BYTES =
  MAX_TOTAL_UPLOAD_BYTES + 64 * 1024;

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    envVar?: string;
    failedSources?: Array<{
      id: string;
      filename: string;
      code: string;
      message: string;
    }>;
  };
}

export interface HttpDeps {
  fixtureDir: string;
  apiKey?: string;
  transport?: ModelTransport;
  runExtractionFn?: typeof runExtraction;
  interpretAnswerFn?: typeof defaultInterpretAnswer;
  maxRequestBytes?: number;
}

const fixtureExtractSchema = z.object({
  source: z.literal("fixture"),
  mode: z.enum(["recorded", "live"]),
});

const interpretRequestSchema = z.object({
  fieldKey: z.string(),
  answerText: z.string(),
  dossier: dossierSchema,
});

function jsonError(
  code: string,
  message: string,
  extra: Partial<ApiErrorBody["error"]> = {},
  status = 400,
): Response {
  return Response.json(
    { error: { code, message, ...extra } },
    { status },
  );
}

function intakeError(uploads: PipelineUpload[]): Response | null {
  const invalid = validateIntakeUploads(uploads);
  if (!invalid) return null;
  return jsonError(invalid.code, invalid.message);
}

function uploadIdFromFilename(filename: string): string {
  return basename(filename).replace(/\.[^.]+$/, "");
}

function assignUniqueUploadIds(uploads: PipelineUpload[]): PipelineUpload[] {
  const used = new Set<string>();
  return uploads.map((upload) => {
    const stem = uploadIdFromFilename(upload.filename);
    let id = stem;
    if (used.has(id)) {
      let suffix = 2;
      while (used.has(`${stem}-${suffix}`)) {
        suffix += 1;
      }
      id = `${stem}-${suffix}`;
    }
    used.add(id);
    return { ...upload, id };
  });
}

function dossierSummary(dossier: DossierField[]): string {
  return dossier.map((field) => `${field.key}: ${field.status}`).join("\n");
}

async function readUploadFile(file: File): Promise<PipelineUpload> {
  const buffer = Buffer.from(await file.arrayBuffer());
  return {
    id: uploadIdFromFilename(file.name),
    filename: file.name,
    mediaType: file.type || "application/octet-stream",
    buffer,
  };
}

function loadFixtureUploads(fixtureDir: string): PipelineUpload[] {
  return [
    "ARK-1500_supplier-specification.txt",
    "ARK-1500_draft-manual.txt",
  ].map((filename) => ({
    id: uploadIdFromFilename(filename),
    filename,
    mediaType: "text/plain",
    buffer: readFileSync(join(fixtureDir, filename)),
  }));
}

function mapModelError(error: ModelError): Response {
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

function mapExtractionStreamError(error: unknown): {
  code: string;
  message: string;
  envVar?: string;
  failedSources?: RunExtractionResult["failedSources"];
} {
  if (error instanceof ModelError) {
    if (error.code === "upstream") {
      return {
        code: "gemini-unavailable",
        message: "The extraction model is temporarily unavailable.",
      };
    }
    return {
      code: error.code,
      message: error.message,
      envVar: error.envVar,
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

function sseEncode(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function serializeExtractionResult(result: RunExtractionResult): Record<string, unknown> {
  return {
    mode: result.mode,
    dossier: result.dossier,
    rejected: result.rejected,
    coverage: result.coverage,
    counts: result.counts,
    ...(result.failedSources ? { failedSources: result.failedSources } : {}),
  };
}

function extractionSseResponse(
  runInput: RunExtractionInput,
  run: typeof runExtraction,
): Response {
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(sseEncode(event, data)));
      };

      try {
        const result = await run({
          ...runInput,
          onProgress: (stage, status) => {
            send("stage", { type: "stage", stage, status });
          },
        });
        send("result", {
          type: "result",
          result: serializeExtractionResult(result),
        });
        controller.close();
      } catch (error) {
        const mapped = mapExtractionStreamError(error);
        send("error", {
          type: "error",
          error: {
            code: mapped.code,
            message: mapped.message,
            ...(mapped.envVar ? { envVar: mapped.envVar } : {}),
            ...(mapped.failedSources
              ? { failedSources: mapped.failedSources }
              : {}),
          },
        });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

export function createApp(deps: HttpDeps) {
  const app = new Hono();
  const run = deps.runExtractionFn ?? runExtraction;
  const interpret = deps.interpretAnswerFn ?? defaultInterpretAnswer;

  app.onError((_error, c) =>
    c.json(
      {
        error: {
          code: "internal-error",
          message: "Unexpected server error.",
        },
      },
      500,
    ),
  );

  app.get("/health", (c) => c.text("ok"));

  app.use(
    "*",
    bodyLimit({
      maxSize: deps.maxRequestBytes ?? DEFAULT_MAX_REQUEST_BYTES,
      onError: (c) =>
        c.json(
          { error: { code: "payload-too-large", message: "Request body too large." } },
          413,
        ),
    }),
  );

  app.post("/api/extract", async (c) => {
    const contentType = c.req.header("content-type") ?? "";

    try {
      if (contentType.includes("application/json")) {
        let raw: unknown;
        try {
          raw = await c.req.json();
        } catch (error) {
          if (error instanceof SyntaxError) {
            return jsonError("invalid-request", "Invalid extract request body.");
          }
          throw error;
        }
        const body = fixtureExtractSchema.parse(raw);

        if (body.mode === "recorded") {
          return extractionSseResponse(
            {
              mode: "recorded",
              fixtureDir: deps.fixtureDir,
            },
            run,
          );
        }

        const uploads = loadFixtureUploads(deps.fixtureDir);
        const invalid = intakeError(uploads);
        if (invalid) return invalid;

        return extractionSseResponse(
          {
            mode: "live",
            uploads,
            transport: deps.transport,
            apiKey: deps.apiKey,
          },
          run,
        );
      }

      if (
        contentType.includes("multipart/form-data") ||
        contentType.includes("application/x-www-form-urlencoded")
      ) {
        const body = await c.req.parseBody({ all: true });
        const rawFiles = body.files;
        const files = Array.isArray(rawFiles)
          ? rawFiles.filter((item): item is File => item instanceof File)
          : rawFiles instanceof File
            ? [rawFiles]
            : [];

        const uploads = assignUniqueUploadIds(
          await Promise.all(files.map(readUploadFile)),
        );
        const invalid = intakeError(uploads);
        if (invalid) return invalid;

        return extractionSseResponse(
          {
            mode: "live",
            uploads,
            transport: deps.transport,
            apiKey: deps.apiKey,
          },
          run,
        );
      }

      return jsonError("invalid-intake", "Expected JSON or multipart upload.");
    } catch (error) {
      if (error instanceof z.ZodError) {
        return jsonError("invalid-request", "Invalid extract request body.");
      }
      throw error;
    }
  });

  app.post("/api/interpret", async (c) => {
    try {
      const body = interpretRequestSchema.parse(await c.req.json());
      const prompt = interpretPrompt({
        fieldKey: body.fieldKey,
        answerText: body.answerText,
        dossierSummary: dossierSummary(body.dossier),
      });
      const result = await interpret({
        prompt,
        transport: deps.transport,
        apiKey: deps.apiKey,
      });
      return Response.json({ proposals: result.proposals });
    } catch (error) {
      if (error instanceof ModelError) {
        if (error.code === "malformed") {
          return jsonError(
            "rephrase",
            "Could not interpret the answer. Please rephrase.",
          );
        }
        return mapModelError(error);
      }
      if (error instanceof z.ZodError || error instanceof SyntaxError) {
        return jsonError("invalid-request", "Invalid interpret request body.");
      }
      throw error;
    }
  });

  return app;
}
