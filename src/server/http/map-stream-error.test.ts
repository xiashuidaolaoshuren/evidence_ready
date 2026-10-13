import { describe, expect, it } from "vitest";
import { ExtractionTimeoutError, TextTooLargeError } from "../pipeline.js";
import { ModelError } from "../model.js";
import { mapExtractionStreamError } from "./map-stream-error";

describe("mapExtractionStreamError", () => {
  it("passes classified model errors through without rewriting", () => {
    expect(
      mapExtractionStreamError(
        new ModelError(
          "model-unavailable",
          "The extraction model is temporarily unavailable.",
        ),
      ),
    ).toEqual({
      code: "model-unavailable",
      message: "The extraction model is temporarily unavailable.",
    });
  });

  it("includes retryAfterSeconds on model errors", () => {
    expect(
      mapExtractionStreamError(
        new ModelError(
          "rate-limited",
          "The model is rate limiting requests. Wait, then retry.",
          undefined,
          25,
        ),
      ),
    ).toMatchObject({
      code: "rate-limited",
      retryAfterSeconds: 25,
    });
  });

  it("keeps pipeline timeout and text budget errors unchanged", () => {
    expect(
      mapExtractionStreamError(new ExtractionTimeoutError()),
    ).toMatchObject({ code: "extraction-timeout" });
    expect(mapExtractionStreamError(new TextTooLargeError())).toMatchObject({
      code: "text-too-large",
    });
  });
});
