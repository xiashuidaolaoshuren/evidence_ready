import "server-only";

import {
  runExtraction,
  type RunExtractionInput,
  type RunExtractionResult,
} from "../../../server/pipeline";

function sseEncode(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function serializeExtractionResult(
  result: RunExtractionResult,
): Record<string, unknown> {
  return {
    mode: result.mode,
    dossier: result.dossier,
    rejected: result.rejected,
    coverage: result.coverage,
    counts: result.counts,
    ...(result.failedSources ? { failedSources: result.failedSources } : {}),
  };
}

export function extractionSseResponse(
  runInput: RunExtractionInput,
  run: typeof runExtraction,
  mapStreamError?: (error: unknown) => {
    code: string;
    message: string;
    envVar?: string;
    failedSources?: RunExtractionResult["failedSources"];
  },
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
        if (!mapStreamError) {
          throw error;
        }
        const mapped = mapStreamError(error);
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
