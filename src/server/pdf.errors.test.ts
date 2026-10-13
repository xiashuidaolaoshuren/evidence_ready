import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { extractPages } from "./pdf.js";

describe("extractPages error mapping", () => {
  it("maps empty TXT to a typed empty error", async () => {
    await expect(
      extractPages({
        id: "empty",
        filename: "empty.txt",
        mediaType: "text/plain",
        buffer: Buffer.from("   \n  "),
      }),
    ).rejects.toMatchObject({ code: "empty" });
  });

  it("maps image-only PDFs to a typed image-only error", async () => {
    const pdf = await PDFDocument.create();
    pdf.addPage();
    const buffer = Buffer.from(await pdf.save());

    await expect(
      extractPages({
        id: "blank",
        filename: "blank.pdf",
        mediaType: "application/pdf",
        buffer,
      }),
    ).rejects.toMatchObject({ code: "image-only" });
  });

  it("maps corrupt PDFs to a typed corrupt error", async () => {
    await expect(
      extractPages({
        id: "corrupt",
        filename: "corrupt.pdf",
        mediaType: "application/pdf",
        buffer: Buffer.from("not a pdf"),
      }),
    ).rejects.toMatchObject({ name: "PdfExtractError", code: "corrupt" });
  });

  it("dispatches on filename extension even when mediaType claims text/plain", async () => {
    await expect(
      extractPages({
        id: "spoofed",
        filename: "spec.pdf",
        mediaType: "text/plain",
        buffer: Buffer.from("%PDF-1.4\nbinary-garbage-here"),
      }),
    ).rejects.toMatchObject({ name: "PdfExtractError", code: "corrupt" });
  });
});
