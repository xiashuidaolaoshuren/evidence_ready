import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultModelLog, prepareModelLogEvent } from "../../server/model.js";

describe("prepareModelLogEvent", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("omits contentPreview on Vercel even when the content flag is set", () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("EVIDENCEREADY_LOG_MODEL_CONTENT", "1");

    const prepared = prepareModelLogEvent({
      phase: "parse-fail",
      attempt: "first",
      contentPreview: "secret excerpt",
    });

    expect(prepared).not.toHaveProperty("contentPreview");
  });

  it("keeps contentPreview off Vercel when the content flag is set", () => {
    vi.stubEnv("VERCEL", "");
    vi.stubEnv("EVIDENCEREADY_LOG_MODEL_CONTENT", "1");

    const prepared = prepareModelLogEvent({
      phase: "response",
      status: 200,
      durationMs: 12,
      contentChars: 4,
      contentPreview: "secret excerpt",
      emptyContent: false,
    });

    expect(prepared).toMatchObject({
      contentPreview: "secret excerpt",
    });
  });

  it("defaultModelLog on Vercel never writes contentPreview", () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("EVIDENCEREADY_LOG_MODEL_CONTENT", "1");
    const info = vi.spyOn(console, "info").mockImplementation(() => {});

    defaultModelLog(
      prepareModelLogEvent({
        phase: "schema-fail",
        issues: [{ path: "candidates", message: "invalid" }],
        contentPreview: "secret excerpt",
      }),
    );

    const line = String(info.mock.calls[0]?.[1]);
    expect(line).not.toContain("secret excerpt");
    expect(line).not.toContain("contentPreview");

    info.mockRestore();
  });
});
