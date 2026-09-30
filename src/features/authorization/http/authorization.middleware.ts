import type { MiddlewareHandler } from "hono";
import { createMiddleware } from "hono/factory";

import type { AuthMiddlewareEnv } from "../../../shared/middlewares/auth.middleware.js";
import {
  hasPermission,
  type AuthorizationPermission,
} from "../domain/authorization.policy.js";

export function createAuthorizationMiddleware(
  permission: AuthorizationPermission,
): MiddlewareHandler<AuthMiddlewareEnv> {
  return createMiddleware<AuthMiddlewareEnv>(async (context, next) => {
    const auth = context.get("auth");

    if (!hasPermission(auth.role, permission)) {
      return context.json(
        {
          error: {
            code: "FORBIDDEN",
            message: "You do not have permission to perform this operation.",
          },
        },
        403,
      );
    }

    await next();
  });
}
