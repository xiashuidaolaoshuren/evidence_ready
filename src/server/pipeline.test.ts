import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PDFDocument } from "pdf-lib";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runExtraction, type ExtractionStageId } from "./pipeline.js";

const fixtureDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../fixtures/kettle",
);

const insufficientFixtureDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../fixtures/insufficient",
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

describe("runExtraction recorded replay", () => {
  it("replays bundled fixtures without OPENROUTER_API_KEY and returns dossier state", async () => {
    delete process.env.OPENROUTER_API_KEY;

    const result = await runExtraction({
      mode: "recorded",
      fixtureDir,
    });

    expect(result.mode).toBe("recorded");
    expect(result.coverage).toBe("interview");
    expect(result.counts.extracted).toBeGreaterThan(0);
    expect(result.counts.rejected).toBe(1);

    const capacity = result.dossier.find((field) => field.key === "capacity");
    const power = result.dossier.find((field) => field.key === "rated-power");
    const importer = result.dossier.find(
      (field) => field.key === "importer-contact",
    );

    expect(capacity?.status).toBe("conflicting");
    expect(power?.status).toBe("unverified");
    expect(importer?.status).toBe("missing");
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0]?.fieldKey).toBe("rated-power");
  });
});

describe("runExtraction live path", () => {
  it("wires pdf extract and mocked gemini without persisting raw uploads", async () => {
    const extraction = readFileSync(
      join(fixtureDir, "recorded-extraction.json"),
      "utf8",
    );
    const transport = vi.fn(async () => extraction);

    const supplier = readFileSync(
      join(fixtureDir, "ARK-1500_supplier-specification.txt"),
    );
    const manual = readFileSync(join(fixtureDir, "ARK-1500_draft-manual.txt"));

    const result = await runExtraction({
      mode: "live",
      uploads: [
        {
          id: "ARK-1500_supplier-specification",
          filename: "ARK-1500_supplier-specification.txt",
          mediaType: "text/plain",
          buffer: supplier,
        },
        {
          id: "ARK-1500_draft-manual",
          filename: "ARK-1500_draft-manual.txt",
          mediaType: "text/plain",
          buffer: manual,
        },
      ],
      transport,
      apiKey: "test-key",
    });

    expect(result.mode).toBe("live");
    expect(result.coverage).toBe("interview");
    expect(transport).toHaveBeenCalledOnce();
    expect(result.counts.rejected).toBe(1);
    expect(result.dossier.find((field) => field.key === "capacity")?.status).toBe(
      "conflicting",
    );
    expect(result.dossier.find((field) => field.key === "rated-power")?.status).toBe(
      "unverified",
    );
  });
});

describe("runExtraction progress", () => {
  it("emits all six stages in order on recorded run", async () => {
    const events: Array<{ stage: ExtractionStageId; status: "started" | "done" }> =
      [];

    await runExtraction({
      mode: "recorded",
      fixtureDir,
      onProgress: (stage, status) => {
        events.push({ stage, status });
      },
    });

    expect(events).toEqual([
      { stage: "read-docs", status: "started" },
      { stage: "read-docs", status: "done" },
      { stage: "model-extract", status: "started" },
      { stage: "model-extract", status: "done" },
      { stage: "validate", status: "started" },
      { stage: "validate", status: "done" },
      { stage: "verify", status: "started" },
      { stage: "verify", status: "done" },
      { stage: "reconcile", status: "started" },
      { stage: "reconcile", status: "done" },
      { stage: "coverage", status: "started" },
      { stage: "coverage", status: "done" },
    ]);
  });

  it("emits read-docs then model-extract before verify on live run", async () => {
    const extraction = readFileSync(
      join(fixtureDir, "recorded-extraction.json"),
      "utf8",
    );
    const transport = vi.fn(async () => extraction);
    const supplier = readFileSync(
      join(fixtureDir, "ARK-1500_supplier-specification.txt"),
    );
    const events: Array<{ stage: ExtractionStageId; status: "started" | "done" }> =
      [];

    await runExtraction({
      mode: "live",
      uploads: [
        {
          id: "ARK-1500_supplier-specification",
          filename: "ARK-1500_supplier-specification.txt",
          mediaType: "text/plain",
          buffer: supplier,
        },
      ],
      transport,
      apiKey: "test-key",
      onProgress: (stage, status) => {
        events.push({ stage, status });
      },
    });

    const startedStages = events
      .filter((event) => event.status === "started")
      .map((event) => event.stage);
    expect(startedStages).toEqual([
      "read-docs",
      "model-extract",
      "validate",
      "verify",
      "reconcile",
      "coverage",
    ]);
    expect(events.indexOf({ stage: "read-docs", status: "done" })).toBeLessThan(
      events.findIndex(
        (event) => event.stage === "model-extract" && event.status === "started",
      ),
    );
  });
});

describe("runExtraction partial failure", () => {
  it("retains facts from successful uploads and reports failedSources", async () => {
    const extraction = readFileSync(join(fixtureDir, "recorded-extraction.json"), "utf8");
    const pdf = await PDFDocument.create();
    pdf.addPage();

    const result = await runExtraction({
      mode: "live",
      uploads: [
        {
          id: "ARK-1500_supplier-specification",
          filename: "ARK-1500_supplier-specification.txt",
          mediaType: "text/plain",
          buffer: readFileSync(
            join(fixtureDir, "ARK-1500_supplier-specification.txt"),
          ),
        },
        {
          id: "blank",
          filename: "blank.pdf",
          mediaType: "application/pdf",
          buffer: Buffer.from(await pdf.save()),
        },
      ],
      transport: vi.fn(async () => extraction),
      apiKey: "test-key",
    });

    expect(result.failedSources).toEqual([
      expect.objectContaining({
        filename: "blank.pdf",
        code: "image-only",
      }),
    ]);
    expect(result.dossier.find((field) => field.key === "product-name")?.status).toBe(
      "confirmed",
    );
  });

  it("retains facts when a corrupt PDF fails and reports failedSources", async () => {
    const extraction = readFileSync(join(fixtureDir, "recorded-extraction.json"), "utf8");

    const result = await runExtraction({
      mode: "live",
      uploads: [
        {
          id: "ARK-1500_supplier-specification",
          filename: "ARK-1500_supplier-specification.txt",
          mediaType: "text/plain",
          buffer: readFileSync(
            join(fixtureDir, "ARK-1500_supplier-specification.txt"),
          ),
        },
        {
          id: "corrupt",
          filename: "corrupt.pdf",
          mediaType: "application/pdf",
          buffer: Buffer.from("not a pdf"),
        },
      ],
      transport: vi.fn(async () => extraction),
      apiKey: "test-key",
    });

    expect(result.failedSources).toEqual([
      expect.objectContaining({
        filename: "corrupt.pdf",
        code: "corrupt",
      }),
    ]);
    expect(result.dossier.find((field) => field.key === "product-name")?.status).toBe(
      "confirmed",
    );
  });
});

describe("runExtraction insufficient coverage", () => {
  it("opens insufficient when thin marketing uploads yield no essential candidates", async () => {
    const transport = vi.fn(async () => JSON.stringify({ candidates: [] }));

    const result = await runExtraction({
      mode: "live",
      uploads: [
        {
          id: "thin-lifestyle-flyer",
          filename: "thin-lifestyle-flyer.txt",
          mediaType: "text/plain",
          buffer: readFileSync(join(insufficientFixtureDir, "thin-lifestyle-flyer.txt")),
        },
        {
          id: "thin-trade-show-card",
          filename: "thin-trade-show-card.pdf",
          mediaType: "application/pdf",
          buffer: readFileSync(join(insufficientFixtureDir, "thin-trade-show-card.pdf")),
        },
      ],
      transport,
      apiKey: "test-key",
    });

    expect(result.coverage).toBe("insufficient");
    expect(result.counts.extracted).toBe(0);
    expect(transport).toHaveBeenCalledOnce();
  });
});

