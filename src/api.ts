import type {
  DossierField,
  ExtractionMode,
  Proposal,
  RejectedCandidate,
} from "./domain/types";

export interface ExtractionCounts {
  extracted: number;
  rejected: number;
  conflicts: number;
  missing: number;
}

export interface FailedSource {
  id: string;
  filename: string;
  code: string;
  message: string;
}

export interface ExtractResponse {
  mode: ExtractionMode;
  dossier: DossierField[];
  rejected: RejectedCandidate[];
  coverage: "interview" | "insufficient";
  counts: ExtractionCounts;
  failedSources?: FailedSource[];
}

export type ExtractionStageId =
  | "read-docs"
  | "model-extract"
  | "validate"
  | "verify"
  | "reconcile"
  | "coverage";

export type ProgressEvent =
  | {
      type: "stage";
      stage: ExtractionStageId;
      status: "started" | "done";
    }
  | { type: "result"; result: ExtractResponse }
  | {
      type: "error";
      error: { code: string; message: string; envVar?: string };
    };

export class ApiError extends Error {
  readonly code: string;
  readonly envVar?: string;

  constructor(code: string, message: string, envVar?: string) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.envVar = envVar;
  }
}

interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    envVar?: string;
  };
}

async function parseApiError(response: Response): Promise<ApiError> {
  try {
    const body = (await response.json()) as ApiErrorBody;
    if (body.error?.code && body.error?.message) {
      return new ApiError(body.error.code, body.error.message, body.error.envVar);
    }
  } catch {
    // fall through
  }
  return new ApiError(
    "internal-error",
    "Unexpected server error.",
  );
}

function parseProgressEvent(raw: unknown): ProgressEvent | null {
  if (typeof raw !== "object" || raw === null || !("type" in raw)) {
    return null;
  }
  const event = raw as ProgressEvent;
  if (event.type === "stage" || event.type === "result" || event.type === "error") {
    return event;
  }
  return null;
}

function parseSseChunk(buffer: string): {
  events: ProgressEvent[];
  remainder: string;
} {
  const events: ProgressEvent[] = [];
  const blocks = buffer.split("\n\n");
  const remainder = blocks.pop() ?? "";

  for (const block of blocks) {
    if (!block.trim()) {
      continue;
    }
    const dataLine = block
      .split("\n")
      .find((line) => line.startsWith("data: "));
    if (!dataLine) {
      continue;
    }
    try {
      const parsed = parseProgressEvent(JSON.parse(dataLine.slice(6)));
      if (parsed) {
        events.push(parsed);
      }
    } catch {
      // ignore malformed blocks
    }
  }

  return { events, remainder };
}

export async function postExtractStream(
  init: RequestInit,
  onEvent: (event: ProgressEvent) => void,
): Promise<ExtractResponse> {
  try {
    const response = await fetch("/api/extract", init);

    if (!response.ok) {
      throw await parseApiError(response);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new ApiError("internal-error", "Unexpected server error.");
    }

    const decoder = new TextDecoder();
    let buffer = "";
    let result: ExtractResponse | null = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      const parsed = parseSseChunk(buffer);
      buffer = parsed.remainder;

      for (const event of parsed.events) {
        if (event.type === "stage") {
          onEvent(event);
        } else if (event.type === "result") {
          result = event.result;
        } else if (event.type === "error") {
          throw new ApiError(
            event.error.code,
            event.error.message,
            event.error.envVar,
          );
        }
      }
    }

    if (buffer.trim()) {
      const parsed = parseSseChunk(`${buffer}\n\n`);
      for (const event of parsed.events) {
        if (event.type === "stage") {
          onEvent(event);
        } else if (event.type === "result") {
          result = event.result;
        } else if (event.type === "error") {
          throw new ApiError(
            event.error.code,
            event.error.message,
            event.error.envVar,
          );
        }
      }
    }

    if (!result) {
      throw new ApiError("internal-error", "Unexpected server error.");
    }

    return result;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError("network", "Network request failed.");
  }
}

async function postExtract(
  init: RequestInit,
  onEvent?: (event: ProgressEvent) => void,
): Promise<ExtractResponse> {
  return postExtractStream(init, onEvent ?? (() => {}));
}

export async function extractFixture(
  mode: ExtractionMode,
  onEvent?: (event: ProgressEvent) => void,
): Promise<ExtractResponse> {
  return postExtract(
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: "fixture", mode }),
    },
    onEvent,
  );
}

export async function extractUpload(
  files: File[],
  onEvent?: (event: ProgressEvent) => void,
): Promise<ExtractResponse> {
  const form = new FormData();
  for (const file of files) {
    form.append("files", file);
  }
  return postExtract(
    {
      method: "POST",
      body: form,
    },
    onEvent,
  );
}

export interface InterpretResponse {
  proposals: Proposal[];
}

export async function interpretAnswer(
  fieldKey: string,
  answerText: string,
  dossier: DossierField[],
): Promise<InterpretResponse> {
  try {
    const response = await fetch("/api/interpret", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fieldKey, answerText, dossier }),
    });

    if (!response.ok) {
      throw await parseApiError(response);
    }

    return response.json() as Promise<InterpretResponse>;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError("network", "Network request failed.");
  }
}
