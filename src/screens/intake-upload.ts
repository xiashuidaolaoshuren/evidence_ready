import {
  checkUploadBudget,
  MAX_TOTAL_UPLOAD_BYTES,
  MAX_UPLOAD_COUNT,
  type UploadBudgetError,
} from "@/domain/upload-limits.js";

export { MAX_TOTAL_UPLOAD_BYTES, MAX_UPLOAD_COUNT } from "@/domain/upload-limits.js";

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

export function validateUploadFiles(files: File[]): string | null {
  const budgetError = checkUploadBudget(files.map((file) => ({ size: file.size })));
  if (budgetError === "file-too-large") {
    const offender = files.find((file) => file.size > MAX_TOTAL_UPLOAD_BYTES);
    return budgetMessage(budgetError, offender?.name);
  }
  if (budgetError) {
    return budgetMessage(budgetError);
  }

  for (const file of files) {
    if (!isAcceptedUpload(file.name)) {
      return `Unsupported file type for ${file.name}. Use PDF or TXT.`;
    }
  }
  return null;
}
