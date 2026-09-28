import { readFileSync } from "node:fs";
import { join } from "node:path";
import { assessCoverage } from "../src/domain/coverage.js";
import { KETTLE_FIELDS } from "../src/domain/fields.js";
import { extractionPrompt } from "../src/domain/prompt.js";
import {
  reconcileCandidates,
  type VerifiedCandidate,
} from "../src/domain/reconcile.js";
import { extractionResponseSchema } from "../src/domain/schemas.js";
import type {
  Candidate,
  DossierField,
  ExtractionMode,
  RejectedCandidate,
} from "../src/domain/types.js";
import { verifyCitation } from "../src/domain/verify.js";
import { fetchExtractionPayload, ModelError, type ModelTransport } from "./model.js";
import { extractPages, PdfExtractError } from "./pdf.js";
import { ZodError } from "zod";

interface PageCorpusDocument {
  id: string;
  filename: string;
  pages: Array<{ pageNumber: number; text: string }>;
}

interface PageCorpus {
  documents: PageCorpusDocument[];
}

export type ExtractionStageId =
  | "read-docs"
  | "model-extract"
  | "validate"
  | "verify"
  | "reconcile"
  | "coverage";

export type ExtractionStageStatus = "started" | "done";

export interface PipelineUpload {
  id: string;
  filename: string;
  mediaType: string;
  buffer: Buffer;
}

export const EXTRACTION_DEADLINE_MS = 110_000;
export const MAX_EXTRACTED_TEXT_CHARS = 100_000;

export interface RunExtractionInput {
  mode: ExtractionMode;
  fixtureDir?: string;
  uploads?: PipelineUpload[];
  transport?: ModelTransport;
  apiKey?: string;
  signal?: AbortSignal;
  deadlineMs?: number;
  onProgress?: (
    stage: ExtractionStageId,
    status: ExtractionStageStatus,
  ) => void;
}

export interface FailedSource {
  id: string;
  filename: string;
  code: string;
  message: string;
}

export class AllSourcesFailedError extends Error {
  readonly failedSources: FailedSource[];

  constructor(failedSources: FailedSource[]) {
    super("All uploaded sources failed to parse.");
    this.name = "AllSourcesFailedError";
    this.failedSources = failedSources;
  }
}

export class ExtractionTimeoutError extends Error {
  constructor() {
    super("Extraction took too long. Try again.");
    this.name = "ExtractionTimeoutError";
  }
}

export class TextTooLargeError extends Error {
  constructor() {
    super(
      "These documents are too long for one extraction. Submit fewer or shorter documents.",
    );
    this.name = "TextTooLargeError";
  }
}

function measureExtractedText(corpus: PageCorpus): number {
  return corpus.documents.reduce(
    (total, document) =>
      total +
      document.pages.reduce((pageTotal, page) => pageTotal + page.text.length, 0),
    0,
  );
}

async function withExtractionDeadline<T>(
  work: () => Promise<T>,
  options: { deadlineMs: number; signal?: AbortSignal },
): Promise<T> {
  if (options.signal?.aborted) {
    throw options.signal.reason ?? new DOMException("Aborted", "AbortError");
  }

  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new ExtractionTimeoutError()),
      options.deadlineMs,
    );
    const onAbort = () => {
      reject(options.signal?.reason ?? new DOMException("Aborted", "AbortError"));
    };
    options.signal?.addEventListener("abort", onAbort, { once: true });

    work()
      .then((value) => {
        clearTimeout(timer);
        options.signal?.removeEventListener("abort", onAbort);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        options.signal?.removeEventListener("abort", onAbort);
        reject(error);
      });
  });
}

export interface RunExtractionResult {
  mode: ExtractionMode;
  dossier: DossierField[];
  rejected: RejectedCandidate[];
  coverage: ReturnType<typeof assessCoverage>;
  counts: {
    extracted: number;
    rejected: number;
    conflicts: number;
    missing: number;
  };
  failedSources?: FailedSource[];
}

function loadJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function buildPageLookup(corpus: PageCorpus): Map<string, Map<number, string>> {
  const lookup = new Map<string, Map<number, string>>();
  for (const document of corpus.documents) {
    const pages = new Map<number, string>();
    for (const page of document.pages) {
      pages.set(page.pageNumber, page.text);
    }
    lookup.set(document.id, pages);
  }
  return lookup;
}

function toCandidate(raw: {
  fieldKey: string;
  value: unknown;
  document: string;
  page: number;
  quote: string;
}): Candidate {
  return {
    fieldKey: raw.fieldKey,
    value: raw.value,
    citation: {
      documentId: raw.document,
      page: raw.page,
      quote: raw.quote,
    },
  };
}

function verifyCandidates(
  candidates: Candidate[],
  pageLookup: Map<string, Map<number, string>>,
): { verified: VerifiedCandidate[]; rejected: RejectedCandidate[] } {
  const verified: VerifiedCandidate[] = [];
  const rejected: RejectedCandidate[] = [];

  for (const candidate of candidates) {
    const pageText =
      pageLookup.get(candidate.citation.documentId)?.get(candidate.citation.page) ??
      "";
    const evidence = verifyCitation(candidate.citation, pageText);
    if (evidence) {
      verified.push({ ...candidate, citation: evidence });
    } else {
      rejected.push({
        ...candidate,
        rejectionReason: "quote not on page",
      });
    }
  }

  return { verified, rejected };
}

function countConflicts(dossier: DossierField[]): number {
  return dossier.filter((field) => field.status === "conflicting").length;
}

function countMissing(dossier: DossierField[]): number {
  return dossier.filter((field) => field.status === "missing").length;
}

function emitProgress(
  onProgress: RunExtractionInput["onProgress"],
  stage: ExtractionStageId,
  status: ExtractionStageStatus,
): void {
  onProgress?.(stage, status);
}

async function readLiveCorpus(
  uploads: PipelineUpload[],
): Promise<{ corpus: PageCorpus; failedSources: FailedSource[] }> {
  const documents: PageCorpusDocument[] = [];
  const failedSources: FailedSource[] = [];

  for (const upload of uploads) {
    try {
      const extracted = await extractPages({
        id: upload.id,
        filename: upload.filename,
        mediaType: upload.mediaType,
        buffer: upload.buffer,
      });
      documents.push({
        id: extracted.id,
        filename: extracted.filename,
        pages: extracted.pages,
      });
    } catch (error) {
      if (error instanceof PdfExtractError) {
        failedSources.push({
          id: upload.id,
          filename: upload.filename,
          code: error.code,
          message: error.message,
        });
        continue;
      }
      throw error;
    }
  }

  if (documents.length === 0) {
    throw new AllSourcesFailedError(failedSources);
  }

  return {
    corpus: { documents },
    failedSources,
  };
}

export async function runExtraction(
  input: RunExtractionInput,
): Promise<RunExtractionResult> {
  const { onProgress } = input;
  let corpus: PageCorpus;
  let failedSources: FailedSource[] = [];
  let extractionPayload: unknown;

  emitProgress(onProgress, "read-docs", "started");
  if (input.mode === "recorded") {
    corpus = loadJson<PageCorpus>(
      join(input.fixtureDir!, "recorded-pages.json"),
    );
  } else {
    const loaded = await readLiveCorpus(input.uploads ?? []);
    corpus = loaded.corpus;
    failedSources = loaded.failedSources;
  }
  emitProgress(onProgress, "read-docs", "done");

  emitProgress(onProgress, "model-extract", "started");
  if (input.mode === "recorded") {
    extractionPayload = loadJson(
      join(input.fixtureDir!, "recorded-extraction.json"),
    );
  } else {
    if (measureExtractedText(corpus) > MAX_EXTRACTED_TEXT_CHARS) {
      throw new TextTooLargeError();
    }

    const prompt = extractionPrompt({ documents: corpus.documents });
    const fetched = await withExtractionDeadline(
      () =>
        fetchExtractionPayload({
          prompt,
          transport: input.transport,
          apiKey: input.apiKey,
        }),
      {
        deadlineMs: input.deadlineMs ?? EXTRACTION_DEADLINE_MS,
        signal: input.signal,
      },
    );
    extractionPayload = fetched.normalized;
  }
  emitProgress(onProgress, "model-extract", "done");

  emitProgress(onProgress, "validate", "started");
  let extraction;
  try {
    extraction = extractionResponseSchema.parse(extractionPayload);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new ModelError("malformed", "The model returned an invalid response.");
    }
    throw error;
  }
  emitProgress(onProgress, "validate", "done");

  const candidates = extraction.candidates.map(toCandidate);
  const pageLookup = buildPageLookup(corpus);

  emitProgress(onProgress, "verify", "started");
  const { verified, rejected } = verifyCandidates(candidates, pageLookup);
  emitProgress(onProgress, "verify", "done");

  emitProgress(onProgress, "reconcile", "started");
  const dossier = reconcileCandidates({
    evidence: verified,
    rejected,
    fields: KETTLE_FIELDS,
  });
  emitProgress(onProgress, "reconcile", "done");

  emitProgress(onProgress, "coverage", "started");
  const coverage = assessCoverage(dossier);
  emitProgress(onProgress, "coverage", "done");

  return {
    mode: input.mode,
    dossier,
    rejected,
    coverage,
    counts: {
      extracted: candidates.length,
      rejected: rejected.length,
      conflicts: countConflicts(dossier),
      missing: countMissing(dossier),
    },
    ...(failedSources.length > 0 ? { failedSources } : {}),
  };
}
