import { z } from "zod";
import {
  FIELD_STATUSES,
  FIELD_TIERS,
  PROVENANCE_MARKERS,
  VALUE_KINDS,
} from "./types";

const extractionCandidateSchema = z.object({
  fieldKey: z.string(),
  value: z.unknown(),
  document: z.string(),
  page: z.number(),
  quote: z.string().trim().min(1),
});

export const extractionResponseSchema = z.object({
  candidates: z.array(extractionCandidateSchema),
});

export type ExtractionResponse = z.infer<typeof extractionResponseSchema>;

const proposalItemSchema = z.object({
  fieldKey: z.string(),
  proposedValue: z.unknown(),
  answerText: z.string(),
});

export const proposalSchema = z.object({
  proposals: z.array(proposalItemSchema),
});

export type ProposalResponse = z.infer<typeof proposalSchema>;

const citationSchema = z.object({
  documentId: z.string(),
  page: z.number(),
  quote: z.string(),
});

const evidenceSchema = citationSchema.extend({
  surroundingWindow: z.string(),
});

const rejectedCandidateSchema = z.object({
  fieldKey: z.string(),
  value: z.unknown(),
  citation: citationSchema,
  rejectionReason: z.string(),
});

const conflictCandidateSchema = z.object({
  value: z.unknown(),
  normalizedValue: z.unknown(),
  citation: citationSchema.optional(),
  source: z.enum(["document", "user"]),
});

const resolutionEventSchema = z.object({
  at: z.string(),
  action: z.string(),
  detail: z.string().optional(),
});

export const dossierFieldSchema = z.object({
  key: z.string(),
  label: z.string(),
  group: z.string(),
  tier: z.enum(FIELD_TIERS),
  valueKind: z.enum(VALUE_KINDS),
  status: z.enum(FIELD_STATUSES),
  originalValue: z.unknown(),
  normalizedValue: z.unknown(),
  markers: z.array(z.enum(PROVENANCE_MARKERS)),
  evidence: z.array(evidenceSchema),
  rejectedCandidates: z.array(rejectedCandidateSchema),
  conflictCandidates: z.array(conflictCandidateSchema).default([]),
  adjudicatedLosers: z.array(conflictCandidateSchema).default([]),
  resolutionHistory: z.array(resolutionEventSchema),
  userSourceDescription: z.string().nullable().optional(),
});

export const dossierSchema = z.array(dossierFieldSchema);
