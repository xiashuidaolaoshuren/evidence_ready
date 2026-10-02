import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { readSseEvents } from "./test-helpers";
import { createExtractHandler } from "./createExtractHandler";

const fixtureDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../fixtures/kettle",
);

describe("createExtractHandler", () => {
  it("returns invalid-request JSON for malformed and invalid JSON bodies", async () => {
    const handler = createExtractHandler({ fixtureDir });

    const malformed = await handler(
      new Request("http://localhost/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{",
      }),
    );
    expect(malformed.status).toBe(400);
    expect(malformed.headers.get("content-type")).toContain("application/json");
    expect(malformed.headers.get("content-type")).not.toContain("text/event-stream");
    expect(await malformed.json()).toMatchObject({
      error: { code: "invalid-request" },
    });

    const invalid = await handler(
      new Request("http://localhost/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "fixture", mode: "bogus" }),
      }),
    );
    expect(invalid.status).toBe(400);
    expect(invalid.headers.get("content-type")).toContain("application/json");
    expect(await invalid.json()).toMatchObject({
      error: { code: "invalid-request" },
    });
  });

  it("streams stage events then result for recorded fixture extraction", async () => {
    const handler = createExtractHandler({ fixtureDir });

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
    expect(events.some((event) => event.type === "stage")).toBe(true);
    expect(events.at(-1)).toMatchObject({ type: "result" });
  });
});
