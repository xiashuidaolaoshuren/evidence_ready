import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { readSseEvents } from "./test-helpers";
import { ExtractionTimeoutError } from "../../../server/pipeline.js";
import { createExtractHandler } from "./createExtractHandler";

describe("createExtractHandler stream errors", () => {
  it("returns SSE internal-error when extraction throws unexpectedly", async () => {
    const handler = createExtractHandler({
      fixtureDir: join(tmpdir(), "unused"),
      runExtractionFn: vi.fn(async () => {
        throw new Error("boom");
      }),
    });

    const response = await handler(
      new Request("http://localhost/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "fixture", mode: "recorded" }),
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    const text = await response.clone().text();
    const events = (await readSseEvents(response)) as Array<{
      type: string;
      error?: { code: string; message: string };
    }>;
    expect(events.at(-1)).toMatchObject({
      type: "error",
      error: {
        code: "internal-error",
        message: "Unexpected server error.",
      },
    });
    expect(events.at(-1)?.error?.code).not.toBe("invalid-request");
    expect(text).not.toMatch(/stack/i);
    expect(text).not.toContain("boom");
  });

  it("returns SSE extraction-timeout when extraction exceeds the deadline", async () => {
    const handler = createExtractHandler({
      fixtureDir: join(tmpdir(), "unused"),
      runExtractionFn: vi.fn(async () => {
        throw new ExtractionTimeoutError();
      }),
    });

    const response = await handler(
      new Request("http://localhost/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "fixture", mode: "recorded" }),
      }),
    );

    const events = (await readSseEvents(response)) as Array<{
      type: string;
      error?: { code: string; message: string };
    }>;
    expect(events.at(-1)).toMatchObject({
      type: "error",
      error: {
        code: "extraction-timeout",
        message: "Extraction took too long. Try again.",
      },
    });
  });

  it("returns SSE internal-error when recorded fixture JSON is corrupt", async () => {
    const dir = mkdtempSync(join(tmpdir(), "evidenceready-"));
    writeFileSync(join(dir, "recorded-extraction.json"), "{");
    writeFileSync(join(dir, "recorded-pages.json"), "{}");
    const handler = createExtractHandler({ fixtureDir: dir });

    const response = await handler(
      new Request("http://localhost/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "fixture", mode: "recorded" }),
      }),
    );

    expect(response.status).toBe(200);
    const events = (await readSseEvents(response)) as Array<{
      type: string;
      error?: { code: string };
    }>;
    expect(events.at(-1)).toMatchObject({
      type: "error",
      error: { code: "internal-error" },
    });
    expect(events.at(-1)?.error?.code).not.toBe("invalid-request");
  });
});
