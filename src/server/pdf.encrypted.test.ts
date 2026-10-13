import { beforeEach, describe, expect, it, vi } from "vitest";

const getDocumentProxy = vi.hoisted(() => vi.fn());
const extractText = vi.hoisted(() => vi.fn());

vi.mock("unpdf", () => ({
  getDocumentProxy,
  extractText,
}));

import { extractPages } from "./pdf.js";

describe("extractPages encrypted mapping", () => {
  beforeEach(() => {
    getDocumentProxy.mockReset();
    extractText.mockReset();
  });

  it("maps encrypted PDFs to a typed encrypted error", async () => {
    getDocumentProxy.mockRejectedValue(
      Object.assign(new Error("Password required"), { name: "PasswordException" }),
    );

    await expect(
      extractPages({
        id: "encrypted",
        filename: "encrypted.pdf",
        mediaType: "application/pdf",
        buffer: Buffer.from("%PDF-1.4"),
      }),
    ).rejects.toMatchObject({ code: "encrypted" });
  });
});
