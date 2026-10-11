import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { extractPages } from "./pdf.js";

const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), "../fixtures/kettle");

describe("extractPages happy path", () => {
  it("returns page-bounded text for TXT uploads with page markers", async () => {
    const buffer = readFileSync(
      join(fixtureDir, "ARK-1500_supplier-specification.txt"),
    );
    const result = await extractPages({
      id: "ARK-1500_supplier-specification",
      filename: "ARK-1500_supplier-specification.txt",
      mediaType: "text/plain",
      buffer,
    });

    expect(result.pages.length).toBeGreaterThanOrEqual(3);
    expect(result.pages[0]?.text).toContain("Acme Rapid Kettle");
    expect(result.pages[1]?.text).toContain("1.5 L");
  });

  it("returns page-bounded text for a valid PDF", async () => {
    const buffer = readFileSync(
      join(fixtureDir, "ARK-1500_supplier-specification.pdf"),
    );
    const result = await extractPages({
      id: "ARK-1500_supplier-specification",
      filename: "ARK-1500_supplier-specification.pdf",
      mediaType: "application/pdf",
      buffer,
    });

    expect(result.pages.length).toBeGreaterThanOrEqual(3);
    expect(result.pages[0]?.text).toContain("Acme Rapid Kettle");
    expect(result.pages[1]?.text).toContain("1.5 L");
  });
});
