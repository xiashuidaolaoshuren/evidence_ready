import { z } from "zod";
import { dossierSchema } from "./domain/schemas";
import { EXTRACTION_MODES } from "./domain/types";
import type {
  DossierField,
  ExtractionMode,
  InterviewState,
  RejectedCandidate,
  Evidence,
} from "./domain/types";

export const SESSION_STORAGE_KEY = "evidenceready.session";

export interface StoredSession {
  dossier: DossierField[];
  rejected: RejectedCandidate[];
  mode: ExtractionMode;
  interview: InterviewState;
  excerpts: Evidence[];
}

export interface SaveSessionResult {
  warned: boolean;
}

const interviewSchema = z.object({
  phase: z.enum(["intake", "extracting", "insufficient", "interview", "report"]),
  currentQuestionFieldKey: z.string().nullable(),
  askedFieldKeys: z.array(z.string()),
  answeredFieldKeys: z.array(z.string()),
  declaredUnavailableFieldKeys: z.array(z.string()),
  questionCount: z.number(),
  continuePastBudget: z.boolean(),
  completionReason: z.string().nullable(),
});

const evidenceSchema = z.object({
  documentId: z.string(),
  page: z.number(),
  quote: z.string(),
  surroundingWindow: z.string(),
});

const storedSessionSchema = z.object({
  dossier: dossierSchema,
  rejected: z.array(
    z.object({
      fieldKey: z.string(),
      value: z.unknown(),
      citation: z.object({
        documentId: z.string(),
        page: z.number(),
        quote: z.string(),
      }),
      rejectionReason: z.string(),
    }),
  ),
  mode: z.enum(EXTRACTION_MODES),
  interview: interviewSchema,
  excerpts: z.array(evidenceSchema),
});

let memorySession: StoredSession | null = null;

function isQuotaError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.name === "QuotaExceededError" || error.name === "NS_ERROR_DOM_QUOTA_REACHED";
}

export function loadSession(): StoredSession | null {
  const raw = globalThis.localStorage?.getItem(SESSION_STORAGE_KEY);
  if (raw) {
    try {
      return storedSessionSchema.parse(JSON.parse(raw));
    } catch {
      return null;
    }
  }
  return memorySession;
}

export function saveSession(session: StoredSession): SaveSessionResult {
  memorySession = session;
  try {
    globalThis.localStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify(session),
    );
    return { warned: false };
  } catch (error) {
    if (isQuotaError(error)) {
      return { warned: true };
    }
    throw error;
  }
}

export function clearSession(): void {
  memorySession = null;
  globalThis.localStorage?.removeItem(SESSION_STORAGE_KEY);
}
