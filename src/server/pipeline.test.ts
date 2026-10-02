import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runExtraction } from "../../server/pipeline.js";

const fixtureDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../fixtures/kettle",
);

const sampleUpload = {
  id: "doc",
  filename: "a.txt",
  mediaType: "text/plain",
  buffer: Buffer.from("hello"),
};

describe("runExtraction deadline", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("aborts live extraction at 110 seconds when the model call hangs", async () => {
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const transport = vi.fn(() => new Promise<string>(() => {}));
    const runPromise = runExtraction({
      mode: "live",
      uploads: [sampleUpload],
      transport,
      apiKey: "test-key",
    });
    runPromise.catch(() => {});

    await vi.advanceTimersByTimeAsync(110_000);

    await expect(runPromise).rejects.toThrow(
      "Extraction took too long. Try again.",
    );
  });

  it("aborts live extraction at 110 seconds when schema repair hangs", async () => {
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const transport = vi.fn(async (prompt: string) => {
      if (prompt.includes("schema repair")) {
        await new Promise<string>(() => {});
      }
      return "not-json";
    });
    const runPromise = runExtraction({
      mode: "live",
      uploads: [sampleUpload],
      transport,
      apiKey: "test-key",
    });
    runPromise.catch(() => {});

    await vi.advanceTimersByTimeAsync(110_000);

    await expect(runPromise).rejects.toThrow(
      "Extraction took too long. Try again.",
    );
    expect(transport).toHaveBeenCalledTimes(2);
  });

  it("returns text-too-large without calling the transport when extracted text exceeds the budget", async () => {
    const transport = vi.fn(async () => '{"candidates":[]}');
    const oversizedText = "x".repeat(100_001);

    await expect(
      runExtraction({
        mode: "live",
        uploads: [
          {
            id: "doc",
            filename: "big.txt",
            mediaType: "text/plain",
            buffer: Buffer.from(oversizedText),
          },
        ],
        transport,
        apiKey: "test-key",
      }),
    ).rejects.toThrow(
      "These documents are too long for one extraction. Submit fewer or shorter documents.",
    );
    expect(transport).not.toHaveBeenCalled();
  });

  it("does not arm the deadline for recorded extraction", async () => {
    const runPromise = runExtraction({
      mode: "recorded",
      fixtureDir,
    });

    await expect(runPromise).resolves.toMatchObject({ mode: "recorded" });
  });
});

describe("runExtraction abort", () => {
  it("stops live extraction when the request signal aborts", async () => {
    const controller = new AbortController();
    const transport = vi.fn(() => new Promise<string>(() => {}));
    const runPromise = runExtraction({
      mode: "live",
      uploads: [sampleUpload],
      transport,
      apiKey: "test-key",
      signal: controller.signal,
    });
    runPromise.catch(() => {});

    await vi.waitFor(() => expect(transport).toHaveBeenCalledTimes(1));
    controller.abort();

    await expect(runPromise).rejects.toMatchObject({ name: "AbortError" });
  });
});
