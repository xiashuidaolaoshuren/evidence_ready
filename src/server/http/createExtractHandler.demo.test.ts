import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { readSseEvents } from "./test-helpers";
import { createExtractHandler } from "./createExtractHandler";

const fixtureDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../fixtures/kettle",
);

describe("createExtractHandler public demo", () => {
  it("returns live-unavailable for live fixture extract", async () => {
    const handler = createExtractHandler({ fixtureDir, publicDemo: true });

    const response = await handler(
      new Request("http://localhost/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "fixture", mode: "live" }),
      }),
    );

    expect(response.status).toBe(403);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(await response.json()).toMatchObject({
      error: {
        code: "live-unavailable",
        message: "Live extraction is not available in this demo.",
      },
    });
  });

  it("returns live-unavailable for multipart upload before reading the body", async () => {
    const runExtractionFn = vi.fn();
    const handler = createExtractHandler({
      fixtureDir,
      publicDemo: true,
      runExtractionFn,
    });

    const response = await handler(
      new Request("http://localhost/api/extract", {
        method: "POST",
        headers: { "Content-Type": "multipart/form-data; boundary=abc" },
        body: "ignored",
      }),
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      error: { code: "live-unavailable" },
    });
    expect(runExtractionFn).not.toHaveBeenCalled();
  });

  it("still streams recorded fixture extraction in public demo", async () => {
    const handler = createExtractHandler({ fixtureDir, publicDemo: true });

    const response = await handler(
      new Request("http://localhost/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "fixture", mode: "recorded" }),
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    const events = (await readSseEvents(response)) as Array<{ type: string }>;
    expect(events.at(-1)).toMatchObject({ type: "result" });
  });
});
