import type { Context } from "hono";

export function errorHandler(error: Error, context: Context): Response {
  return context.json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred.",
      },
    },
    500,
  );
}
