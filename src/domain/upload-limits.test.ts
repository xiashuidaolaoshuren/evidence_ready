import { describe, expect, it } from "vitest";
import {
  checkUploadBudget,
  MAX_TOTAL_UPLOAD_BYTES,
  MAX_UPLOAD_COUNT,
} from "./upload-limits.js";

const FOUR_MB = 4 * 1024 * 1024;

describe("upload limits", () => {
  it("exports shared count and total byte cap", () => {
    expect(MAX_UPLOAD_COUNT).toBe(3);
    expect(MAX_TOTAL_UPLOAD_BYTES).toBe(FOUR_MB);
  });
});

describe("checkUploadBudget", () => {
  it("rejects empty, too many, oversize single file, and oversize total", () => {
    expect(checkUploadBudget([])).toBe("empty");
    expect(checkUploadBudget([{ size: 1 }, { size: 1 }, { size: 1 }, { size: 1 }])).toBe(
      "too-many",
    );
    expect(checkUploadBudget([{ size: FOUR_MB + 1 }])).toBe("file-too-large");
    expect(
      checkUploadBudget([
        { size: FOUR_MB / 2 + 1 },
        { size: FOUR_MB / 2 + 1 },
      ]),
    ).toBe("total-too-large");
  });

  it("accepts one file at the total cap", () => {
    expect(checkUploadBudget([{ size: FOUR_MB }])).toBeNull();
  });

  it("accepts multiple files whose sum is at the cap", () => {
    expect(
      checkUploadBudget([
        { size: FOUR_MB / 2 },
        { size: FOUR_MB / 2 },
      ]),
    ).toBeNull();
  });
});
