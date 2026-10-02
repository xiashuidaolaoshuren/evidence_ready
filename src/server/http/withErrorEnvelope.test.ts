import { describe, expect, it } from "vitest";
import { withErrorEnvelope } from "./withErrorEnvelope";

describe("withErrorEnvelope", () => {
  it("returns internal-error JSON 500 without stack or filesystem path", async () => {
    const fixturePath = "C:\\secret\\fixtures\\kettle";
    const handler = withErrorEnvelope(async () => {
      throw new Error(`Failed reading ${fixturePath}`);
    });

    const response = await handler(
      new Request("http://localhost/api/extract", { method: "POST" }),
    );

    expect(response.status).toBe(500);
    const body = await response.text();
    expect(JSON.parse(body)).toMatchObject({
      error: {
        code: "internal-error",
        message: "Unexpected server error.",
      },
    });
    expect(body).not.toMatch(/stack/i);
    expect(body).not.toContain(fixturePath);
  });
});
