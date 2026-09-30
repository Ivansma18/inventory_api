import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import type { MiddlewareHandler } from "hono";

import type { ListUsersInput } from "../application/authorization.service.js";
import type { UserListResult } from "../domain/authorization.repository.js";
import type { AuthMiddlewareEnv } from "../../../shared/middlewares/auth.middleware.js";
import { createAuthorizationMiddleware } from "./authorization.middleware.js";
import { toAuthorizationUserListResponse } from "./authorization.mapper.js";
import {
  authorizationErrorResponseSchema,
  authorizationUserListResponseSchema,
  userListQuerySchema,
} from "./authorization.schemas.js";

export interface AuthorizationHttpService {
  listUsers(input?: ListUsersInput): Promise<UserListResult>;
}

interface AuthorizationRoutesDependencies {
  service: AuthorizationHttpService;
  authMiddleware: MiddlewareHandler<AuthMiddlewareEnv>;
}

const listUsersRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["Authorization"],
  security: [{ sessionCookie: [] }],
  request: { query: userListQuerySchema },
  responses: {
    200: {
      content: {
        "application/json": { schema: authorizationUserListResponseSchema },
      },
      description: "Users retrieved",
    },
    400: {
      content: {
        "application/json": { schema: authorizationErrorResponseSchema },
      },
      description: "Invalid pagination query",
    },
    401: {
      content: {
        "application/json": { schema: authorizationErrorResponseSchema },
      },
      description: "Authentication required",
    },
    403: {
      content: {
        "application/json": { schema: authorizationErrorResponseSchema },
      },
      description: "Administrator role required",
    },
  },
});

export function createAuthorizationRoutes({
  service,
  authMiddleware,
}: AuthorizationRoutesDependencies): OpenAPIHono<AuthMiddlewareEnv> {
  const routes = new OpenAPIHono<AuthMiddlewareEnv>({
    defaultHook: (result, context) => {
      if (!result.success) {
        return context.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: "Request validation failed.",
            },
          },
          400,
        );
      }
    },
  });

  routes.use("/", authMiddleware);
  routes.use("/", createAuthorizationMiddleware("users:list"));
  routes.openapi(listUsersRoute, async (context) => {
    const { page, limit } = context.req.valid("query");
    const result = await service.listUsers({ page, limit });

    return context.json(
      toAuthorizationUserListResponse(result, page, limit),
      200,
    );
  });

  return routes;
}
