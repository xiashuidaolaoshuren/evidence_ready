import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { readSseEvents } from "./test-helpers";
import { createExtractHandler } from "./createExtractHandler";

const fixtureDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../fixtures/kettle",
);

describe("createExtractHandler abort", () => {
  it("passes request.signal into runExtraction and stops on abort", async () => {
    let capturedSignal: AbortSignal | undefined;
    const runExtractionFn = vi.fn(async (input: { signal?: AbortSignal }) => {
      capturedSignal = input.signal;
      await new Promise<never>((_, reject) => {
        input.signal?.addEventListener(
          "abort",
          () => reject(input.signal?.reason ?? new DOMException("Aborted", "AbortError")),
          { once: true },
        );
      });
    });
    const handler = createExtractHandler({ fixtureDir, runExtractionFn });
    const controller = new AbortController();

    const response = await handler(
      new Request("http://localhost/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "fixture", mode: "recorded" }),
        signal: controller.signal,
      }),
    );

    await vi.waitFor(() => expect(runExtractionFn).toHaveBeenCalled());
    expect(capturedSignal).toEqual(expect.any(AbortSignal));
    expect(capturedSignal?.aborted).toBe(false);

    controller.abort();
    await vi.waitFor(() => expect(capturedSignal?.aborted).toBe(true));
    const events = (await readSseEvents(response)) as Array<{
      type: string;
      error?: { code: string };
    }>;
    expect(events.at(-1)?.error?.code).not.toBe("extraction-timeout");
  });
});
