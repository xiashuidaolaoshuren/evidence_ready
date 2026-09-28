import {
  extractionResponseSchema,
  proposalSchema,
  type ExtractionResponse,
  type ProposalResponse,
} from "../src/domain/schemas.js";
import { ZodError } from "zod";

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
    return rest;
  }
  if (event.phase === "parse-fail" || event.phase === "schema-fail") {
    const { contentPreview: _contentPreview, ...rest } = event;
    return rest;
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
  | "quota"
  | "auth"
  | "network"
  | "malformed"
  | "upstream";

export class ModelError extends Error {
  readonly code: ModelErrorCode;
  readonly envVar?: string;

  constructor(code: ModelErrorCode, message: string, envVar?: string) {
    super(message);
    this.name = "ModelError";
    this.code = code;
    this.envVar = envVar;
  }
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

  if (status === 401 || status === 403) {
    return new ModelError("auth", "Model authentication failed.");
  }
  if (status === 402 || status === 429) {
    return new ModelError("quota", "Model quota or rate limit exceeded.");
  }
  if (error instanceof TypeError) {
    return new ModelError("network", "Model network request failed.");
  }

  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (message.includes("quota") || message.includes("rate limit")) {
    return new ModelError("quota", "Model quota or rate limit exceeded.");
  }
  if (message.includes("unauthorized") || message.includes("authentication")) {
    return new ModelError("auth", "Model authentication failed.");
  }
  if (message.includes("fetch failed") || message.includes("network")) {
    return new ModelError("network", "Model network request failed.");
  }
  if (status !== undefined && status >= 500) {
    return new ModelError("upstream", "Model service request failed.");
  }

  return new ModelError("upstream", "Model service request failed.");
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
      throw new ModelError("malformed", "The model returned malformed JSON.");
    }
  }
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
      throw Object.assign(new Error(body || response.statusText), {
        status: response.status,
      });
    }

    const payload = (await response.json()) as {
      choices?: Array<{
        finish_reason?: string;
        message?: Record<string, unknown> & { content?: string };
      }>;
    };
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
