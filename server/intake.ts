import {
  checkUploadBudget,
  MAX_TOTAL_UPLOAD_BYTES,
  MAX_UPLOAD_COUNT,
  type UploadBudgetError,
} from "@/domain/upload-limits";
import type { PipelineUpload } from "./pipeline";

export { MAX_TOTAL_UPLOAD_BYTES, MAX_UPLOAD_COUNT } from "@/domain/upload-limits";

export interface IntakeValidationError {
  code: "invalid-intake";
  message: string;
}

const TOTAL_LIMIT_LABEL = "4 MB total";

function isAcceptedUpload(filename: string): boolean {
  const lower = filename.toLowerCase();
  return lower.endsWith(".pdf") || lower.endsWith(".txt");
}

function budgetMessage(error: UploadBudgetError, filename?: string): string {
  switch (error) {
    case "empty":
      return "At least one file is required.";
    case "too-many":
      return `No more than ${MAX_UPLOAD_COUNT} files are allowed.`;
    case "file-too-large":
      return `File ${filename ?? "upload"} exceeds the ${TOTAL_LIMIT_LABEL} limit.`;
    case "total-too-large":
      return `Combined upload size exceeds the ${TOTAL_LIMIT_LABEL} limit.`;
  }
}

export function validateIntakeUploads(
  uploads: PipelineUpload[],
): IntakeValidationError | null {
  const budgetError = checkUploadBudget(
    uploads.map((upload) => ({ size: upload.buffer.byteLength })),
  );
  if (budgetError === "file-too-large") {
    const offender = uploads.find(
      (upload) => upload.buffer.byteLength > MAX_TOTAL_UPLOAD_BYTES,
    );
    return {
      code: "invalid-intake",
      message: budgetMessage(budgetError, offender?.filename),
    };
  }
  if (budgetError) {
    return {
      code: "invalid-intake",
      message: budgetMessage(budgetError),
    };
  }

  for (const upload of uploads) {
    if (!isAcceptedUpload(upload.filename)) {
      return {
        code: "invalid-intake",
        message: `Unsupported file type for ${upload.filename}. Use PDF or TXT.`,
      };
    }
  }
  return null;
}
