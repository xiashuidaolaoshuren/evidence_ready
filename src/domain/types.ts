export const FIELD_TIERS = ["essential", "supporting"] as const;
export type FieldTier = (typeof FIELD_TIERS)[number];

export const VALUE_KINDS = ["scalar", "list", "prose"] as const;
export type ValueKind = (typeof VALUE_KINDS)[number];

export const FIELD_STATUSES = [
  "confirmed",
  "user-provided",
  "unverified",
  "conflicting",
  "missing",
] as const;
export type FieldStatus = (typeof FIELD_STATUSES)[number];

export const PROVENANCE_MARKERS = ["adjudicated", "declaredUnavailable"] as const;
export type ProvenanceMarker = (typeof PROVENANCE_MARKERS)[number];

export const EXTRACTION_MODES = ["recorded", "live"] as const;
export type ExtractionMode = (typeof EXTRACTION_MODES)[number];

export interface DocumentPage {
  pageNumber: number;
  text: string;
}

export interface Document {
  id: string;
  filename: string;
  mediaType: string;
  size: number;
  pages: DocumentPage[];
}

export interface Citation {
  documentId: string;
  page: number;
  quote: string;
  surroundingWindow?: string;
}

export interface Evidence extends Citation {
  surroundingWindow: string;
}

export interface Candidate {
  fieldKey: string;
  value: unknown;
  citation: Citation;
}

export interface RejectedCandidate extends Candidate {
  rejectionReason: string;
}

export interface ResolutionEvent {
  at: string;
  action: string;
  detail?: string;
}

export interface DossierField {
  key: string;
  label: string;
  group: string;
  tier: FieldTier;
  valueKind: ValueKind;
  status: FieldStatus;
  originalValue: unknown;
  normalizedValue: unknown;
  markers: ProvenanceMarker[];
  evidence: Evidence[];
  rejectedCandidates: RejectedCandidate[];
  conflictCandidates: ConflictCandidate[];
  adjudicatedLosers: ConflictCandidate[];
  resolutionHistory: ResolutionEvent[];
  userSourceDescription?: string | null;
}

export interface ConflictCandidate {
  value: unknown;
  normalizedValue: unknown;
  citation?: Citation;
  source: "document" | "user";
}

export interface Conflict {
  fieldKey: string;
  candidates: ConflictCandidate[];
}

export interface Proposal {
  fieldKey: string;
  proposedValue: unknown;
  answerText: string;
}

export type InterviewPhase =
  | "intake"
  | "extracting"
  | "insufficient"
  | "interview"
  | "report";

export interface InterviewState {
  phase: InterviewPhase;
  currentQuestionFieldKey: string | null;
  askedFieldKeys: string[];
  answeredFieldKeys: string[];
  declaredUnavailableFieldKeys: string[];
  questionCount: number;
  continuePastBudget: boolean;
  completionReason: string | null;
  essentialsClear?: boolean;
  continueSupporting?: boolean;
  pausedForBudget?: boolean;
  exhaustedFieldKeys?: string[];
}
