import { describe, expect, it, vi } from "vitest";
import type { DossierField } from "@/domain/types";
import { ModelError } from "../../../server/model.js";
import { createInterpretHandler } from "./createInterpretHandler";

function sampleDossier(): DossierField[] {
  return [
    {
      key: "importer-contact",
      label: "Importer or responsible-party contact",
      group: "Identity and Responsibility",
      tier: "essential",
      valueKind: "prose",
      status: "missing",
      originalValue: null,
      normalizedValue: null,
      markers: [],
      evidence: [],
      rejectedCandidates: [],
      conflictCandidates: [],
      adjudicatedLosers: [],
      resolutionHistory: [],
    },
  ];
}

describe("createInterpretHandler", () => {
  it("returns JSON proposals for a valid interpret request", async () => {
    const interpretAnswerFn = vi.fn(async () => ({
      proposals: [{ fieldKey: "capacity", proposedValue: "1.7 L", answerText: "1.7 L" }],
    }));
    const handler = createInterpretHandler({
      fixtureDir: ".",
      apiKey: "test-key",
      interpretAnswerFn,
    });

    const response = await handler(
      new Request("http://localhost/api/interpret", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fieldKey: "capacity",
          answerText: "1.7 L",
          dossier: sampleDossier(),
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(await response.json()).toMatchObject({
      proposals: [{ fieldKey: "capacity" }],
    });
  });

  it("returns invalid-request JSON for malformed and invalid bodies", async () => {
    const interpretAnswerFn = vi.fn();
    const handler = createInterpretHandler({
      fixtureDir: ".",
      apiKey: "test-key",
      interpretAnswerFn,
    });

    const malformed = await handler(
      new Request("http://localhost/api/interpret", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{",
      }),
    );
    expect(malformed.status).toBe(400);
    expect(malformed.headers.get("content-type")).toContain("application/json");
    expect(await malformed.json()).toMatchObject({
      error: { code: "invalid-request" },
    });

    const invalid = await handler(
      new Request("http://localhost/api/interpret", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fieldKey: "capacity",
          answerText: "1.7 L",
          dossier: [null],
        }),
      }),
    );
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toMatchObject({
      error: { code: "invalid-request" },
    });
    expect(interpretAnswerFn).not.toHaveBeenCalled();
  });

  it("returns gemini-unavailable JSON for upstream model faults", async () => {
    const handler = createInterpretHandler({
      fixtureDir: ".",
      apiKey: "test-key",
      interpretAnswerFn: vi.fn(async () => {
        throw new ModelError("upstream", "The extraction model is temporarily unavailable.");
      }),
    });

    const response = await handler(
      new Request("http://localhost/api/interpret", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fieldKey: "capacity",
          answerText: "1.7 L",
          dossier: sampleDossier(),
        }),
      }),
    );

    expect(response.status).toBe(503);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(await response.json()).toMatchObject({
      error: { code: "gemini-unavailable" },
    });
  });
});
