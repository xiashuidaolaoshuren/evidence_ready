import {
  extractionResponseSchema,
  proposalSchema,
  type ExtractionResponse,
  type ProposalResponse,
} from "@/domain/schemas";
import { ZodError } from "zod";
import { classifyModelFailure, type ModelFailure } from "./model-failure";

export const OPENROUTER_MODEL = "deepseek/deepseek-v4-flash-vision-exp";
export const OPENROUTER_CHAT_URL =
  "https://openrouter.ai/api/v1/chat/completions";

export type ModelTransport = (prompt: string) => Promise<string>;

export type ModelLogEvent =
  | {
      phase: "request";
      model: string;
      promptChars: number;
    }
  | {
      phase: "response";
      status: number;
      durationMs: number;
      finishReason?: string;
      contentChars: number;
      contentPreview: string;
      emptyContent: boolean;
      messageKeys?: string[];
    }
  | {
      phase: "parse-fail";
      attempt: "first" | "repair";
      contentPreview: string;
    }
  | {
      phase: "schema-fail";
      issues: Array<{ path: string; message: string }>;
      contentPreview: string;
    };

export type ModelLogFn = (event: ModelLogEvent) => void;

const CONTENT_PREVIEW_LIMIT = 500;

function stripContentPreview(event: ModelLogEvent): ModelLogEvent {
  if (event.phase === "response") {
    const { contentPreview: _contentPreview, ...rest } = event;
    return rest as ModelLogEvent;
  }
  if (event.phase === "parse-fail" || event.phase === "schema-fail") {
    const { contentPreview: _contentPreview, ...rest } = event;
    return rest as ModelLogEvent;
  }
  return event;
}

export function prepareModelLogEvent(event: ModelLogEvent): ModelLogEvent {
  if (process.env.VERCEL) {
    return stripContentPreview(event);
  }
  if (process.env.EVIDENCEREADY_LOG_MODEL_CONTENT === "1") {
    return event;
  }
  return stripContentPreview(event);
}

export function defaultModelLog(event: ModelLogEvent): void {
  console.info("[model]", sanitizeLogOutput(JSON.stringify(event)));
}

function emitModelLog(log: ModelLogFn, event: ModelLogEvent): void {
  log(prepareModelLogEvent(event));
}

export function sanitizeLogOutput(serialized: string): string {
  return serialized
    .replace(/Bearer\s+\S+/gi, "Bearer [REDACTED]")
    .replace(/sk-or-v1-[A-Za-z0-9_-]+/g, "[REDACTED_KEY]");
}

function previewContent(content: string): string {
  return content.slice(0, CONTENT_PREVIEW_LIMIT);
}

function messageKeys(
  message: Record<string, unknown> | undefined,
): string[] | undefined {
  if (!message) return undefined;
  const keys = Object.keys(message).filter((key) => key !== "content" && key !== "role");
  return keys.length > 0 ? keys : undefined;
}

export type ModelErrorCode =
  | "missing-key"
  | "rate-limited"
  | "out-of-credits"
  | "auth"
  | "model-blocked"
  | "model-not-found"
  | "text-too-large"
  | "model-unavailable"
  | "model-rejected"
  | "malformed";

export class ModelError extends Error {
  readonly code: ModelErrorCode;
  readonly envVar?: string;
  readonly retryAfterSeconds?: number;

  constructor(
    code: ModelErrorCode,
    message: string,
    envVar?: string,
    retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "ModelError";
    this.code = code;
    this.envVar = envVar;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

function modelErrorFromFailure(failure: ModelFailure): ModelError {
  return new ModelError(
    failure.code,
    failure.message,
    undefined,
    failure.retryAfterSeconds,
  );
}

interface ModelCallOptions {
  prompt: string;
  transport?: ModelTransport;
  apiKey?: string;
  log?: ModelLogFn;
}

function formatZodIssues(error: ZodError): Array<{ path: string; message: string }> {
  return error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));
}

function requireApiKey(apiKey: string | undefined): string {
  if (apiKey && apiKey.trim().length > 0) return apiKey.trim();
  throw new ModelError(
    "missing-key",
    "OPENROUTER_API_KEY is not configured. Use recorded extraction mode or set OPENROUTER_API_KEY.",
    "OPENROUTER_API_KEY",
  );
}

function mapTransportError(error: unknown): ModelError {
  if (error instanceof ModelError) return error;

  const status =
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof error.status === "number"
      ? error.status
      : undefined;

  const errorType =
    typeof error === "object" &&
    error !== null &&
    "errorType" in error &&
    typeof error.errorType === "string"
      ? error.errorType
      : undefined;

  const retryAfterHeader =
    typeof error === "object" &&
    error !== null &&
    "retryAfterHeader" in error &&
    typeof error.retryAfterHeader === "string"
      ? error.retryAfterHeader
      : undefined;

  if (error instanceof TypeError) {
    return modelErrorFromFailure(classifyModelFailure({ network: true }));
  }

  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (message.includes("fetch failed") || message.includes("network")) {
    return modelErrorFromFailure(classifyModelFailure({ network: true }));
  }

  return modelErrorFromFailure(
    classifyModelFailure({ status, errorType, retryAfterHeader }),
  );
}

async function callTransport(
  prompt: string,
  transport: ModelTransport,
): Promise<string> {
  try {
    return await transport(prompt);
  } catch (error) {
    throw mapTransportError(error);
  }
}

function parseJson(raw: string): unknown {
  return JSON.parse(raw);
}

async function requestStructuredJson(
  prompt: string,
  transport: ModelTransport,
  log: ModelLogFn = defaultModelLog,
): Promise<{ parsed: unknown; rawContent: string }> {
  const first = await callTransport(prompt, transport);
  try {
    return { parsed: parseJson(first), rawContent: first };
  } catch {
    emitModelLog(log, {
      phase: "parse-fail",
      attempt: "first",
      contentPreview: previewContent(first),
    });
    const repairPrompt = [
      prompt,
      "",
      "schema repair: return valid JSON only. Do not include markdown fences.",
    ].join("\n");
    const repaired = await callTransport(repairPrompt, transport);
    try {
      return { parsed: parseJson(repaired), rawContent: repaired };
    } catch {
      emitModelLog(log, {
        phase: "parse-fail",
        attempt: "repair",
        contentPreview: previewContent(repaired),
      });
      throw new ModelError("malformed", "The model returned an invalid response.");
    }
  }
}

interface OpenRouterChatPayload {
  error?: {
    message?: string;
    metadata?: { error_type?: string };
  };
  choices?: Array<{
    finish_reason?: string;
    message?: Record<string, unknown> & { content?: string };
  }>;
}

function throwClassifiedResponseFailure(
  response: Response,
  errorObject: OpenRouterChatPayload["error"],
): never {
  throw modelErrorFromFailure(
    classifyModelFailure({
      status: response.status,
      errorType: errorObject?.metadata?.error_type,
      retryAfterHeader: response.headers.get("Retry-After") ?? undefined,
    }),
  );
}

export function createDefaultTransport(
  apiKey: string,
  options: { log?: ModelLogFn } = {},
): ModelTransport {
  const log = options.log ?? defaultModelLog;

  return async (prompt: string) => {
    emitModelLog(log, {
      phase: "request",
      model: OPENROUTER_MODEL,
      promptChars: prompt.length,
    });

    const startedAt = Date.now();
    const response = await fetch(OPENROUTER_CHAT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      let errorType: string | undefined;
      try {
        const parsed = JSON.parse(body) as OpenRouterChatPayload;
        errorType = parsed.error?.metadata?.error_type;
      } catch {
        // non-JSON error bodies fall back to HTTP status
      }
      throw Object.assign(new Error(body || response.statusText), {
        status: response.status,
        errorType,
        retryAfterHeader: response.headers.get("Retry-After") ?? undefined,
      });
    }

    const payload = (await response.json()) as OpenRouterChatPayload;
    const choice = payload.choices?.[0];
    const message = choice?.message;
    const content = message?.content ?? "";

    emitModelLog(log, {
      phase: "response",
      status: response.status,
      durationMs: Date.now() - startedAt,
      finishReason: choice?.finish_reason,
      contentChars: content.length,
      contentPreview: previewContent(content),
      emptyContent: content.length === 0,
      messageKeys: messageKeys(message),
    });

    if (payload.error && content.length === 0) {
      throwClassifiedResponseFailure(response, payload.error);
    }

    return content;
  };
}

export async function fetchExtractionPayload(
  options: ModelCallOptions,
): Promise<{ normalized: unknown; rawContent: string }> {
  const apiKey = requireApiKey(options.apiKey ?? process.env.OPENROUTER_API_KEY);
  const log = options.log ?? defaultModelLog;
  const transport =
    options.transport ?? createDefaultTransport(apiKey, { log });
  const { parsed, rawContent } = await requestStructuredJson(
    options.prompt,
    transport,
    log,
  );
  return {
    normalized: Array.isArray(parsed) ? { candidates: parsed } : parsed,
    rawContent,
  };
}

export async function extractCandidates(
  options: ModelCallOptions,
): Promise<ExtractionResponse> {
  const log = options.log ?? defaultModelLog;
  const { normalized, rawContent } = await fetchExtractionPayload(options);
  try {
    return extractionResponseSchema.parse(normalized);
  } catch (error) {
    if (error instanceof ZodError) {
      emitModelLog(log, {
        phase: "schema-fail",
        issues: formatZodIssues(error),
        contentPreview: previewContent(rawContent),
      });
    }
    throw new ModelError("malformed", "The model returned an invalid response.");
  }
}

export async function interpretAnswer(
  options: ModelCallOptions,
): Promise<ProposalResponse> {
  const apiKey = requireApiKey(options.apiKey ?? process.env.OPENROUTER_API_KEY);
  const log = options.log ?? defaultModelLog;
  const transport =
    options.transport ?? createDefaultTransport(apiKey, { log });
  const { parsed, rawContent } = await requestStructuredJson(
    options.prompt,
    transport,
    log,
  );
  const normalized = Array.isArray(parsed) ? { proposals: parsed } : parsed;
  try {
    return proposalSchema.parse(normalized);
  } catch (error) {
    if (error instanceof ZodError) {
      emitModelLog(log, {
        phase: "schema-fail",
        issues: formatZodIssues(error),
        contentPreview: previewContent(rawContent),
      });
    }
    throw new ModelError("malformed", "The model returned an invalid response.");
  }
}
