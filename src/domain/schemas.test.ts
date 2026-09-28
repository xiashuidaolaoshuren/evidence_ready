import { describe, expect, it } from "vitest";
import { extractionResponseSchema } from "./schemas";

const validCandidate = {
  fieldKey: "capacity",
  value: "1.5 L",
  document: "doc-supplier-spec",
  page: 2,
  quote: "Capacity: 1.5 L",
};

describe("extractionResponseSchema", () => {
  it("accepts a fully-cited candidate", () => {
    const result = extractionResponseSchema.parse({
      candidates: [validCandidate],
    });

    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]).toEqual(validCandidate);
  });

  it("rejects a candidate missing document", () => {
    const { document: _document, ...missingDocument } = validCandidate;

    expect(() =>
      extractionResponseSchema.parse({ candidates: [missingDocument] }),
    ).toThrow();
  });

  it("rejects a candidate missing page", () => {
    const { page: _page, ...missingPage } = validCandidate;

    expect(() =>
      extractionResponseSchema.parse({ candidates: [missingPage] }),
    ).toThrow();
  });

  it("rejects a candidate missing quote", () => {
    const { quote: _quote, ...missingQuote } = validCandidate;

    expect(() =>
      extractionResponseSchema.parse({ candidates: [missingQuote] }),
    ).toThrow();
  });

  it("rejects an empty quote", () => {
    expect(() =>
      extractionResponseSchema.parse({
        candidates: [{ ...validCandidate, quote: "" }],
      }),
    ).toThrow();
  });

  it("rejects a whitespace-only quote", () => {
    expect(() =>
      extractionResponseSchema.parse({
        candidates: [{ ...validCandidate, quote: "   " }],
      }),
    ).toThrow();
  });
});

describe("extractionResponseSchema confidence", () => {
  it("does not surface a model-supplied confidence field", () => {
    const result = extractionResponseSchema.parse({
      candidates: [{ ...validCandidate, confidence: 0.95 }],
    });

    expect(result.candidates[0]).not.toHaveProperty("confidence");
  });
});

describe("proposalSchema", () => {
  it("accepts a valid proposal", async () => {
    const { proposalSchema } = await import("./schemas.js");
    const result = proposalSchema.parse({
      proposals: [
        {
          fieldKey: "importer-contact",
          proposedValue: "Acme Imports, contact@acme.example",
          answerText: "Acme Imports, contact@acme.example",
        },
      ],
    });

    expect(result.proposals).toHaveLength(1);
  });

  it("rejects a proposal missing fieldKey", async () => {
    const { proposalSchema } = await import("./schemas.js");

    expect(() =>
      proposalSchema.parse({
        proposals: [
          {
            proposedValue: "Acme Imports",
            answerText: "Acme Imports",
          },
        ],
      }),
    ).toThrow();
  });

  it("rejects a proposal missing proposedValue", async () => {
    const { proposalSchema } = await import("./schemas.js");

    expect(() =>
      proposalSchema.parse({
        proposals: [
          {
            fieldKey: "importer-contact",
            answerText: "Acme Imports",
          },
        ],
      }),
    ).toThrow();
  });
});

describe("dossierSchema", () => {
  it("rejects null and non-object dossier members", async () => {
    const { dossierSchema } = await import("./schemas.js");

    expect(dossierSchema.safeParse([null]).success).toBe(false);
    expect(dossierSchema.safeParse(["nope"]).success).toBe(false);
  });
});
