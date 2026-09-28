import { describe, expect, it } from "vitest";
import { MAX_TOTAL_UPLOAD_BYTES, MAX_UPLOAD_COUNT } from "../src/domain/upload-limits.js";
import { validateIntakeUploads } from "./intake.js";

const FOUR_MB = MAX_TOTAL_UPLOAD_BYTES;

describe("validateIntakeUploads", () => {
  it("rejects empty, oversize, unsupported, and too many uploads", () => {
    expect(validateIntakeUploads([])?.message).toContain("At least one file");

    expect(
      validateIntakeUploads([
        {
          id: "big",
          filename: "big.pdf",
          mediaType: "application/pdf",
          buffer: Buffer.alloc(FOUR_MB + 1),
        },
      ])?.message,
    ).toContain("4 MB total");

    expect(
      validateIntakeUploads([
        {
          id: "a",
          filename: "a.pdf",
          mediaType: "application/pdf",
          buffer: Buffer.alloc(FOUR_MB / 2 + 1),
        },
        {
          id: "b",
          filename: "b.pdf",
          mediaType: "application/pdf",
          buffer: Buffer.alloc(FOUR_MB / 2 + 1),
        },
      ])?.message,
    ).toContain("4 MB total");

    expect(
      validateIntakeUploads([
        {
          id: "bad",
          filename: "notes.docx",
          mediaType: "application/msword",
          buffer: Buffer.from("x"),
        },
      ])?.message,
    ).toContain("Unsupported file type");

    expect(
      validateIntakeUploads([
        {
          id: "spoofed",
          filename: "notes.docx",
          mediaType: "application/pdf",
          buffer: Buffer.from("x"),
        },
      ])?.message,
    ).toContain("Unsupported file type");

    expect(
      validateIntakeUploads(
        Array.from({ length: MAX_UPLOAD_COUNT + 1 }, (_, index) => ({
          id: `file-${index}`,
          filename: `file-${index}.txt`,
          mediaType: "text/plain",
          buffer: Buffer.from("x"),
        })),
      )?.message,
    ).toContain(String(MAX_UPLOAD_COUNT));
  });

  it("accepts one upload at the 4 MB total cap", () => {
    expect(
      validateIntakeUploads([
        {
          id: "cap",
          filename: "cap.pdf",
          mediaType: "application/pdf",
          buffer: Buffer.alloc(FOUR_MB),
        },
      ]),
    ).toBeNull();
  });
});
