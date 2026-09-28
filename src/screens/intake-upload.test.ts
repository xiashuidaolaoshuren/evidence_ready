import { describe, expect, it } from "vitest";
import { MAX_TOTAL_UPLOAD_BYTES } from "@/domain/upload-limits.js";
import { validateUploadFiles } from "./intake-upload.js";

const FOUR_MB = MAX_TOTAL_UPLOAD_BYTES;

function file(name: string, size = 100): File {
  return new File(["x"], name, { type: "application/octet-stream", lastModified: 0 });
}

function sizedFile(name: string, size: number): File {
  const blob = file(name);
  Object.defineProperty(blob, "size", { value: size });
  return blob;
}

describe("validateUploadFiles", () => {
  it("rejects when no files are selected", () => {
    expect(validateUploadFiles([])).toMatch(/at least one file/i);
  });

  it("rejects more than three files", () => {
    const files = [
      file("a.pdf"),
      file("b.pdf"),
      file("c.pdf"),
      file("d.pdf"),
    ];
    expect(validateUploadFiles(files)).toMatch(/no more than 3/i);
  });

  it("rejects a single file over the 4 MB total limit", () => {
    expect(validateUploadFiles([sizedFile("big.pdf", FOUR_MB + 1)])).toMatch(
      /4 MB total/i,
    );
  });

  it("rejects when combined file sizes exceed the 4 MB total limit", () => {
    expect(
      validateUploadFiles([
        sizedFile("a.pdf", FOUR_MB / 2 + 1),
        sizedFile("b.pdf", FOUR_MB / 2 + 1),
      ]),
    ).toMatch(/4 MB total/i);
  });

  it("accepts one file at the 4 MB total cap", () => {
    expect(validateUploadFiles([sizedFile("cap.pdf", FOUR_MB)])).toBeNull();
  });

  it("rejects unsupported extensions", () => {
    expect(validateUploadFiles([file("notes.docx")])).toMatch(/unsupported/i);
  });

  it("accepts valid PDF and TXT files within the total cap", () => {
    expect(validateUploadFiles([file("spec.pdf"), file("manual.txt")])).toBeNull();
  });
});
