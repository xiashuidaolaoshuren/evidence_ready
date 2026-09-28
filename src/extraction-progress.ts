import type { ExtractionStageId, ProgressEvent } from "./api";

export const EXTRACTION_STAGE_ORDER: ExtractionStageId[] = [
  "read-docs",
  "model-extract",
  "validate",
  "verify",
  "reconcile",
  "coverage",
];

export function stageIndex(stage: ExtractionStageId): number {
  return EXTRACTION_STAGE_ORDER.indexOf(stage);
}

export function progressFromEvent(
  event: Extract<ProgressEvent, { type: "stage" }>,
): { currentStage: number; stageStatus: "started" | "done" } | null {
  const currentStage = stageIndex(event.stage);
  if (currentStage < 0) {
    return null;
  }
  return {
    currentStage,
    stageStatus: event.status,
  };
}
