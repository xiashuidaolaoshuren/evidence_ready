import { z } from "zod";
import type { AppPhase, ExtractionCounts, FailedSource } from "@/state/app-state";
import { KETTLE_FIELDS } from "@/domain/fields";
import { dossierSchema } from "@/domain/schemas";
import { EXTRACTION_MODES } from "@/domain/types";
import type {
  DossierField,
  ExtractionMode,
  InterviewState,
  RejectedCandidate,
  Evidence,
} from "@/domain/types";

export const SESSION_STORAGE_KEY = "evidenceready.session";
export const SESSION_VERSION = 2 as const;
export const SESSION_RESTORE_NOTICE =
  "The saved session could not be restored.";
export const SESSION_EXPIRY_NOTICE =
  "The saved session expired after seven days without activity.";
export const SESSION_PERSISTENCE_WARNING =
  "Progress cannot be saved. Refreshing or closing this page will lose this session.";
export const SESSION_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

export interface StoredSession {
  version: typeof SESSION_VERSION;
  updatedAt: string;
  phase: AppPhase;
  dossier: DossierField[];
  rejected: RejectedCandidate[];
  mode: ExtractionMode;
  counts: ExtractionCounts | null;
  failedSources?: FailedSource[];
  interview: InterviewState;
  excerpts: Evidence[];
}

export type SaveSessionInput = Omit<StoredSession, "version" | "updatedAt">;

export interface SaveSessionResult {
  warned: boolean;
  warning?: string;
}

export interface LoadSessionResult {
  session: StoredSession | null;
  notice: string | null;
}

export interface SessionTimingOptions {
  now?: Date;
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
  essentialsClear: z.boolean().optional(),
  continueSupporting: z.boolean().optional(),
  pausedForBudget: z.boolean().optional(),
  exhaustedFieldKeys: z.array(z.string()).optional(),
});

const evidenceSchema = z.object({
  documentId: z.string(),
  page: z.number(),
  quote: z.string(),
  surroundingWindow: z.string(),
});

const failedSourceSchema = z.object({
  id: z.string(),
  filename: z.string(),
  code: z.string(),
  message: z.string(),
});

const countsSchema = z.object({
  extracted: z.number(),
  rejected: z.number(),
  conflicts: z.number(),
  missing: z.number(),
});

const storedSessionSchema = z.object({
  version: z.literal(SESSION_VERSION),
  updatedAt: z.string(),
  phase: z.enum(["intake", "extracting", "extracted", "insufficient", "interview", "report"]),
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
  counts: countsSchema.nullable(),
  failedSources: z.array(failedSourceSchema).optional(),
  interview: interviewSchema,
  excerpts: z.array(evidenceSchema),
});

let memorySession: StoredSession | null = null;

const DISCARDED_PHASES = new Set<AppPhase>(["intake", "extracting"]);

function isQuotaError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.name === "QuotaExceededError" || error.name === "NS_ERROR_DOM_QUOTA_REACHED";
}

function discardStoredSession(): LoadSessionResult {
  clearSession();
  return { session: null, notice: null };
}

function shouldDiscardImmediately(session: StoredSession): boolean {
  return DISCARDED_PHASES.has(session.phase);
}

const KETTLE_FIELD_KEYS = new Set(KETTLE_FIELDS.map((field) => field.key));

function isInterviewFieldKey(key: string): boolean {
  return KETTLE_FIELD_KEYS.has(key);
}

function isConsistentSession(session: StoredSession): boolean {
  if (Number.isNaN(Date.parse(session.updatedAt))) {
    return false;
  }

  if (session.dossier.length !== KETTLE_FIELDS.length) {
    return false;
  }

  const dossierKeys = new Set(session.dossier.map((field) => field.key));
  if (dossierKeys.size !== KETTLE_FIELDS.length) {
    return false;
  }
  for (const field of KETTLE_FIELDS) {
    if (!dossierKeys.has(field.key)) {
      return false;
    }
  }

  const interviewFieldKeys = [
    ...session.interview.askedFieldKeys,
    ...session.interview.answeredFieldKeys,
    ...session.interview.declaredUnavailableFieldKeys,
    ...(session.interview.currentQuestionFieldKey
      ? [session.interview.currentQuestionFieldKey]
      : []),
    ...(session.interview.exhaustedFieldKeys ?? []),
  ];
  if (!interviewFieldKeys.every(isInterviewFieldKey)) {
    return false;
  }

  return true;
}

function rejectInconsistentSession(): LoadSessionResult {
  clearSession();
  return { session: null, notice: SESSION_RESTORE_NOTICE };
}

function isExpiredSession(session: StoredSession, now: Date): boolean {
  const updatedAt = Date.parse(session.updatedAt);
  if (updatedAt > now.getTime()) {
    return false;
  }
  return now.getTime() - updatedAt > SESSION_RETENTION_MS;
}

function rejectExpiredSession(): LoadSessionResult {
  clearSession();
  return { session: null, notice: SESSION_EXPIRY_NOTICE };
}

function finalizeLoadedSession(
  session: StoredSession,
  now: Date,
): LoadSessionResult {
  if (shouldDiscardImmediately(session)) {
    return discardStoredSession();
  }
  if (!isConsistentSession(session)) {
    return rejectInconsistentSession();
  }
  if (isExpiredSession(session, now)) {
    return rejectExpiredSession();
  }
  return { session, notice: null };
}

export function loadSession(
  options: SessionTimingOptions = {},
): LoadSessionResult {
  const now = options.now ?? new Date();
  const raw = globalThis.localStorage?.getItem(SESSION_STORAGE_KEY);
  if (raw) {
    try {
      const session = storedSessionSchema.parse(JSON.parse(raw));
      return finalizeLoadedSession(session, now);
    } catch {
      return discardStoredSession();
    }
  }
  if (memorySession) {
    const result = finalizeLoadedSession(memorySession, now);
    if (result.session === null) {
      memorySession = null;
    }
    return result;
  }
  return { session: null, notice: null };
}

function persistStoredSession(stored: StoredSession): SaveSessionResult {
  const storage = globalThis.localStorage;
  if (!storage) {
    return { warned: true, warning: SESSION_PERSISTENCE_WARNING };
  }

  try {
    storage.setItem(SESSION_STORAGE_KEY, JSON.stringify(stored));
    return { warned: false };
  } catch (error) {
    if (isQuotaError(error)) {
      return { warned: true, warning: SESSION_PERSISTENCE_WARNING };
    }
    throw error;
  }
}

export function saveSession(
  session: SaveSessionInput,
  options: SessionTimingOptions = {},
): SaveSessionResult {
  const now = options.now ?? new Date();
  const stored: StoredSession = {
    version: SESSION_VERSION,
    updatedAt: now.toISOString(),
    ...session,
  };
  memorySession = stored;
  return persistStoredSession(stored);
}

export function clearSession(): void {
  memorySession = null;
  globalThis.localStorage?.removeItem(SESSION_STORAGE_KEY);
}
