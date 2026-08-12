import type { Context } from "hono";
import type { StatusCode } from "hono/utils/http-status";

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly code?: string
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function handleError(err: Error, c: Context) {
  if (err instanceof AppError) {
    return c.json(
      {
        error: {
          message: err.message,
          code: err.code ?? "APP_ERROR",
        },
      },
      err.statusCode as StatusCode
    );
  }

  console.error("Unhandled error:", err);

  return c.json(
    {
      error: {
        message: "Internal server error",
        code: "INTERNAL_SERVER_ERROR",
      },
    },
    500
  );
}
