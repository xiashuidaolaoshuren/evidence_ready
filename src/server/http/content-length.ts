import "server-only";

import type { RouteHandler } from "./withErrorEnvelope";

export function contentLengthResponse(
  request: Request,
  maxBytes: number,
): Response | null {
  const header = request.headers.get("content-length");
  if (!header) {
    return null;
  }

  const length = Number.parseInt(header, 10);
  if (Number.isNaN(length) || length <= maxBytes) {
    return null;
  }

  return Response.json(
    {
      error: {
        code: "payload-too-large",
        message: "Request body too large.",
      },
    },
    { status: 413 },
  );
}

export function withContentLengthLimit(
  handler: RouteHandler,
  maxBytes: number,
): RouteHandler {
  return async (request) => {
    const limited = contentLengthResponse(request, maxBytes);
    if (limited) {
      return limited;
    }
    return handler(request);
  };
}
