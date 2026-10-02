export const MAX_UPLOAD_COUNT = 3;
export const MAX_TOTAL_UPLOAD_BYTES = 4 * 1024 * 1024;

export type UploadBudgetError =
  | "empty"
  | "too-many"
  | "file-too-large"
  | "total-too-large";

export interface UploadSizeCheck {
  size: number;
}

export function checkUploadBudget(
  files: readonly UploadSizeCheck[],
): UploadBudgetError | null {
  if (files.length === 0) return "empty";
  if (files.length > MAX_UPLOAD_COUNT) return "too-many";

  let total = 0;
  for (const file of files) {
    if (file.size > MAX_TOTAL_UPLOAD_BYTES) return "file-too-large";
    total += file.size;
  }
  if (total > MAX_TOTAL_UPLOAD_BYTES) return "total-too-large";
  return null;
}
