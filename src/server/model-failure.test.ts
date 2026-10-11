import { describe, expect, it } from "vitest";
import { classifyModelFailure } from "./model-failure.js";

describe("classifyModelFailure", () => {
  it("maps rate_limit_exceeded and 429 to rate-limited with Retry-After seconds", () => {
    expect(
      classifyModelFailure({
        errorType: "rate_limit_exceeded",
        retryAfterHeader: "30",
      }),
    ).toEqual({
      code: "rate-limited",
      message: "The model is rate limiting requests. Wait, then retry.",
      retryAfterSeconds: 30,
    });

    expect(classifyModelFailure({ status: 429 })).toMatchObject({
      code: "rate-limited",
    });
  });

  it("caps retryAfterSeconds at 120 and omits invalid Retry-After", () => {
    expect(
      classifyModelFailure({
        errorType: "rate_limit_exceeded",
        retryAfterHeader: "999",
      }).retryAfterSeconds,
    ).toBe(120);

    expect(
      classifyModelFailure({
        errorType: "rate_limit_exceeded",
        retryAfterHeader: "nope",
      }),
    ).not.toHaveProperty("retryAfterSeconds");
  });

  it("maps payment_required and 402 to out-of-credits", () => {
    expect(classifyModelFailure({ errorType: "payment_required" })).toEqual({
      code: "out-of-credits",
      message:
        "The OpenRouter account has no credits left. Recorded extraction still works.",
    });
    expect(classifyModelFailure({ status: 402 })).toMatchObject({
      code: "out-of-credits",
    });
  });

  it("maps authentication and 401 to auth", () => {
    expect(classifyModelFailure({ errorType: "authentication" })).toEqual({
      code: "auth",
      message: "The OpenRouter API key was rejected.",
    });
    expect(classifyModelFailure({ status: 401 })).toMatchObject({
      code: "auth",
    });
  });

  it("maps permission types and 403 to model-blocked, never auth", () => {
    expect(classifyModelFailure({ errorType: "permission_denied" })).toMatchObject({
      code: "model-blocked",
    });
    expect(classifyModelFailure({ status: 403 })).toMatchObject({
      code: "model-blocked",
      message: "The model provider blocked this request.",
    });
  });

  it("maps not_found and 404 to model-not-found", () => {
    expect(classifyModelFailure({ errorType: "not_found" })).toMatchObject({
      code: "model-not-found",
    });
    expect(classifyModelFailure({ status: 404 })).toMatchObject({
      code: "model-not-found",
    });
  });

  it("maps context_length_exceeded on 400 to text-too-large, not model-rejected", () => {
    expect(
      classifyModelFailure({
        status: 400,
        errorType: "context_length_exceeded",
      }),
    ).toEqual({
      code: "text-too-large",
      message:
        "These documents are too long for one extraction. Submit fewer or shorter documents.",
    });
    expect(classifyModelFailure({ errorType: "string_too_long" })).toMatchObject({
      code: "text-too-large",
    });
  });

  it("maps provider overload and 5xx to model-unavailable", () => {
    expect(classifyModelFailure({ errorType: "provider_unavailable" })).toEqual({
      code: "model-unavailable",
      message: "The extraction model is temporarily unavailable.",
    });
    expect(classifyModelFailure({ status: 503 })).toMatchObject({
      code: "model-unavailable",
    });
  });

  it("maps network flag to model-unavailable with reach message", () => {
    expect(classifyModelFailure({ network: true })).toEqual({
      code: "model-unavailable",
      message: "The model could not be reached.",
    });
  });

  it("maps invalid request types and other 400 to model-rejected", () => {
    expect(classifyModelFailure({ errorType: "invalid_request" })).toEqual({
      code: "model-rejected",
      message: "The model rejected this request. Retrying will not help.",
    });
    expect(classifyModelFailure({ status: 400 })).toMatchObject({
      code: "model-rejected",
    });
    expect(classifyModelFailure({ status: 412 })).toMatchObject({
      code: "model-rejected",
    });
  });
});
