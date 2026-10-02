import { describe, expect, it } from "vitest";
import { MAX_TOTAL_UPLOAD_BYTES } from "@/domain/upload-limits";
import { withContentLengthLimit } from "./content-length";

const MAX_REQUEST_BYTES = MAX_TOTAL_UPLOAD_BYTES + 64 * 1024;

describe("withContentLengthLimit", () => {
  it("returns 413 payload-too-large before the handler reads the body", async () => {
    let bodyRead = false;
    const handler = withContentLengthLimit(
      async (request) => {
        await request.json();
        bodyRead = true;
        return new Response("ok");
      },
      MAX_REQUEST_BYTES,
    );

    const response = await handler(
      new Request("http://localhost/api/extract", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": String(MAX_REQUEST_BYTES + 1),
        },
        body: "{",
      }),
    );

    expect(response.status).toBe(413);
    expect(await response.json()).toMatchObject({
      error: {
        code: "payload-too-large",
        message: "Request body too large.",
      },
    });
    expect(bodyRead).toBe(false);
  });

  it("does not reject a request without Content-Length", async () => {
    const handler = withContentLengthLimit(
      async () => new Response("ok"),
      MAX_REQUEST_BYTES,
    );

    const response = await handler(
      new Request("http://localhost/api/extract", { method: "POST" }),
    );

    expect(response.status).toBe(200);
  });
});
