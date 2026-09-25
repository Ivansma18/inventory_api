import type { Context, MiddlewareHandler } from "hono";
import { createMiddleware } from "hono/factory";

import { auth } from "../../features/auth/auth.config.js";
import { toPublicAuthUser } from "../../features/auth/http/auth.mapper.js";
import type { AuthIdentity } from "../../features/auth/auth.types.js";

export type AuthMiddlewareEnv = {
  Variables: {
    auth: AuthIdentity;
  };
};

export const authMiddleware: MiddlewareHandler<AuthMiddlewareEnv> =
  createMiddleware<AuthMiddlewareEnv>(async (context, next) => {
    try {
      const session = await auth.api.getSession({
        headers: context.req.raw.headers,
      });

      if (!session?.user || !session.session) {
        return unauthorizedResponse(context);
      }

      context.set("auth", toPublicAuthUser(session.user));
      await next();
    } catch {
      return unauthorizedResponse(context);
    }
  });

function unauthorizedResponse(context: Context<AuthMiddlewareEnv>) {
  return context.json(
    {
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication required",
      },
    },
    401,
  );
}
