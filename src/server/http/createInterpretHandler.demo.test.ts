import { describe, expect, it, vi } from "vitest";
import type { DossierField } from "@/domain/types";
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

describe("createInterpretHandler public demo", () => {
  it("returns live-unavailable without calling interpret", async () => {
    const interpretAnswerFn = vi.fn();
    const handler = createInterpretHandler({
      fixtureDir: ".",
      publicDemo: true,
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

    expect(response.status).toBe(403);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(await response.json()).toMatchObject({
      error: {
        code: "live-unavailable",
        message: "Answer interpretation is not available in this demo.",
      },
    });
    expect(interpretAnswerFn).not.toHaveBeenCalled();
  });
});
