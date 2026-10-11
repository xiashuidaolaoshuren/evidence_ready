import { describe, expect, it } from "vitest";
import { ModelError } from "../model.js";
import { mapModelError } from "./map-model-error";

describe("mapModelError", () => {
  it("maps model-unavailable to HTTP 503 with the server message", async () => {
    const response = mapModelError(
      new ModelError(
        "model-unavailable",
        "The extraction model is temporarily unavailable.",
      ),
    );
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      error: {
        code: "model-unavailable",
        message: "The extraction model is temporarily unavailable.",
      },
    });
  });

  it("maps auth to HTTP 401", async () => {
    const response = mapModelError(
      new ModelError("auth", "The OpenRouter API key was rejected."),
    );
    expect(response.status).toBe(401);
  });

  it("keeps missing-key at HTTP 400 with envVar", async () => {
    const response = mapModelError(
      new ModelError(
        "missing-key",
        "OPENROUTER_API_KEY is not configured. Use recorded extraction mode or set OPENROUTER_API_KEY.",
        "OPENROUTER_API_KEY",
      ),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: {
        code: "missing-key",
        envVar: "OPENROUTER_API_KEY",
      },
    });
  });

  it("includes retryAfterSeconds on the JSON envelope", async () => {
    const response = mapModelError(
      new ModelError(
        "rate-limited",
        "The model is rate limiting requests. Wait, then retry.",
        undefined,
        30,
      ),
    );
    expect(response.status).toBe(429);
    expect(await response.json()).toMatchObject({
      error: {
        code: "rate-limited",
        retryAfterSeconds: 30,
      },
    });
  });
});
