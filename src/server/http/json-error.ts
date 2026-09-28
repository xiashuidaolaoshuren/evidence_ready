import "server-only";

import type { ApiErrorBody } from "./types";

export function jsonError(
  code: string,
  message: string,
  extra: Partial<ApiErrorBody["error"]> = {},
  status = 400,
): Response {
  return Response.json(
    { error: { code, message, ...extra } },
    { status },
  );
}
