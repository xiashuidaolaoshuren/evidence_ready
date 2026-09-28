import "server-only";

import { z } from "zod";
import { interpretPrompt } from "@/domain/prompt";
import { dossierSchema } from "@/domain/schemas";
import type { DossierField } from "@/domain/types";
import {
  interpretAnswer as defaultInterpretAnswer,
  ModelError,
} from "../../../server/model.js";
import { withContentLengthLimit } from "./content-length";
import { jsonError } from "./json-error";
import { mapModelError } from "./map-model-error";
import { DEFAULT_MAX_REQUEST_BYTES, type HttpDeps } from "./types";
import {
  isPublicDemo,
  liveInterpretUnavailableResponse,
} from "./public-demo";
import { withErrorEnvelope } from "./withErrorEnvelope";

const interpretRequestSchema = z.object({
  fieldKey: z.string(),
  answerText: z.string(),
  dossier: dossierSchema,
});

function dossierSummary(dossier: DossierField[]): string {
  return dossier.map((field) => `${field.key}: ${field.status}`).join("\n");
}

export function createInterpretHandler(deps: HttpDeps) {
  const interpret = deps.interpretAnswerFn ?? defaultInterpretAnswer;

  const handler = async (request: Request) => {
    if (isPublicDemo(deps)) {
      return liveInterpretUnavailableResponse();
    }

    try {
      let raw: unknown;
      try {
        raw = await request.json();
      } catch (error) {
        if (error instanceof SyntaxError) {
          return jsonError("invalid-request", "Invalid interpret request body.");
        }
        throw error;
      }

      const body = interpretRequestSchema.parse(raw);
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
      if (error instanceof z.ZodError) {
        return jsonError("invalid-request", "Invalid interpret request body.");
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
