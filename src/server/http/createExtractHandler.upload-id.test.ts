import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import type { RunExtractionInput, RunExtractionResult } from "../pipeline";
import { createExtractHandler } from "./createExtractHandler";

const fixtureDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../fixtures/kettle",
);

const emptyResult: RunExtractionResult = {
  mode: "live",
  dossier: [],
  rejected: [],
  coverage: "insufficient",
  counts: { extracted: 0, rejected: 0, conflicts: 0, missing: 0 },
};

describe("createExtractHandler upload ids", () => {
  it("assigns distinct ids when upload basenames collide", async () => {
    let uploadIds: string[] = [];
    const runExtractionFn = vi.fn(async (input: RunExtractionInput) => {
      uploadIds = (input.uploads ?? []).map((upload) => upload.id);
      return emptyResult;
    });
    const handler = createExtractHandler({
      fixtureDir,
      publicDemo: false,
      runExtractionFn,
    });

    const form = new FormData();
    form.append("files", new File(["spec"], "report.pdf", { type: "application/pdf" }));
    form.append("files", new File(["notes"], "report.txt", { type: "text/plain" }));
    form.append("files", new File(["copy"], "report.pdf", { type: "application/pdf" }));

    const response = await handler(
      new Request("http://localhost/api/extract", {
        method: "POST",
        body: form,
      }),
    );
    await response.text();

    expect(uploadIds).toEqual(["report", "report-2", "report-3"]);
  });
});
