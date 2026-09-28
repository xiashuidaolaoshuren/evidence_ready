import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ApiError,
  extractFixture,
  extractUpload,
  interpretAnswer,
  postExtractStream,
  type ExtractResponse,
} from "./api";

function sseResultResponse(result: ExtractResponse): Response {
  const body = `event: result\ndata: ${JSON.stringify({ type: "result", result })}\n\n`;
  return new Response(body, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

function sseErrorResponse(code: string, message: string, envVar?: string): Response {
  const body = `event: error\ndata: ${JSON.stringify({
    type: "error",
    error: { code, message, ...(envVar ? { envVar } : {}) },
  })}\n\n`;
  return new Response(body, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

describe("postExtractStream", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("parses SSE stage events from a ReadableStream", async () => {
    const sseBody = [
      'event: stage\ndata: {"type":"stage","stage":"read-docs","status":"started"}\n\n',
      'event: stage\ndata: {"type":"stage","stage":"read-docs","status":"done"}\n\n',
      'event: result\ndata: {"type":"result","result":{"mode":"recorded","dossier":[],"rejected":[],"coverage":"interview","counts":{"extracted":0,"rejected":0,"conflicts":0,"missing":0}}}\n\n',
    ].join("");

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(sseBody));
        controller.close();
      },
    });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(stream, {
          status: 200,
          headers: { "Content-Type": "text/event-stream" },
        }),
      ),
    );

    const events: unknown[] = [];
    const result = await postExtractStream(
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "fixture", mode: "recorded" }),
      },
      (event) => {
        events.push(event);
      },
    );

    expect(events).toEqual([
      { type: "stage", stage: "read-docs", status: "started" },
      { type: "stage", stage: "read-docs", status: "done" },
    ]);
    expect(result.mode).toBe("recorded");
    expect(result.coverage).toBe("interview");
  });
});

describe("extractFixture", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts JSON fixture body and parses success", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      sseResultResponse({
        mode: "recorded",
        dossier: [],
        rejected: [],
        coverage: "interview",
        counts: { extracted: 0, rejected: 0, conflicts: 0, missing: 0 },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await extractFixture("recorded");

    expect(fetchMock).toHaveBeenCalledWith("/api/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: "fixture", mode: "recorded" }),
    });
    expect(result.mode).toBe("recorded");
    expect(result.coverage).toBe("interview");
  });

  it("rejects with ApiError on missing-key including envVar", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        sseErrorResponse(
          "missing-key",
          "OpenRouter API key is not configured.",
          "OPENROUTER_API_KEY",
        ),
      ),
    );

    await expect(extractFixture("live")).rejects.toMatchObject({
      code: "missing-key",
      envVar: "OPENROUTER_API_KEY",
    });
    await expect(extractFixture("live")).rejects.toBeInstanceOf(ApiError);
  });

  it("rejects with ApiError on SSE error event", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        sseErrorResponse("internal-error", "Unexpected server error."),
      ),
    );

    await expect(extractFixture("recorded")).rejects.toMatchObject({
      code: "internal-error",
    });
  });

  it("rejects with network code when fetch throws", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
    );

    await expect(extractFixture("recorded")).rejects.toMatchObject({
      code: "network",
    });
  });
});

describe("extractUpload", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts multipart with repeated files field", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      sseResultResponse({
        mode: "live",
        dossier: [],
        rejected: [],
        coverage: "interview",
        counts: { extracted: 0, rejected: 0, conflicts: 0, missing: 0 },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const files = [
      new File(["a"], "one.pdf", { type: "application/pdf" }),
      new File(["b"], "two.txt", { type: "text/plain" }),
    ];

    await extractUpload(files);

    expect(fetchMock).toHaveBeenCalledOnce();
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("POST");
    expect(init.body).toBeInstanceOf(FormData);
    const form = init.body as FormData;
    expect(form.getAll("files")).toHaveLength(2);
    expect((form.getAll("files")[0] as File).name).toBe("one.pdf");
    expect((form.getAll("files")[1] as File).name).toBe("two.txt");
  });
});

describe("interpretAnswer", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts fieldKey answerText and dossier, then parses proposals", async () => {
    const dossier = [{ key: "importer-contact", status: "missing" }];
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          proposals: [
            {
              fieldKey: "importer-contact",
              proposedValue: "Acme Imports GmbH",
              answerText: "Acme Imports GmbH — rated power 2200 W",
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await interpretAnswer(
      "importer-contact",
      "Acme Imports GmbH — rated power 2200 W",
      dossier as never,
    );

    expect(fetchMock).toHaveBeenCalledWith("/api/interpret", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fieldKey: "importer-contact",
        answerText: "Acme Imports GmbH — rated power 2200 W",
        dossier,
      }),
    });
    expect(result.proposals).toHaveLength(1);
  });

  it("rejects with rephrase when interpretation fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: {
              code: "rephrase",
              message: "Could not interpret the answer. Please rephrase.",
            },
          }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    await expect(
      interpretAnswer("importer-contact", "???", [] as never),
    ).rejects.toMatchObject({ code: "rephrase" });
  });
});
