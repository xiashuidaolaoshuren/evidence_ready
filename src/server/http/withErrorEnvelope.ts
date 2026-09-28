import "server-only";

export type RouteHandler = (request: Request) => Response | Promise<Response>;

export function withErrorEnvelope(handler: RouteHandler): RouteHandler {
  return async (request) => {
    try {
      return await handler(request);
    } catch {
      return Response.json(
        {
          error: {
            code: "internal-error",
            message: "Unexpected server error.",
          },
        },
        { status: 500 },
      );
    }
  };
}
