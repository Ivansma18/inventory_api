import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import type { MiddlewareHandler } from "hono";

import type { ListUsersInput } from "../application/authorization.service.js";
import type {
  AuthorizationUserSummary,
  UserListResult,
} from "../domain/authorization.repository.js";
import type { AuthMiddlewareEnv } from "../../../shared/middlewares/auth.middleware.js";
import { errorHandler } from "../../../shared/errors/error-handler.js";
import {
  AuthorizationUserNotFoundError,
  LastAdminRoleChangeError,
} from "../domain/authorization.errors.js";
import { createAuthorizationMiddleware } from "./authorization.middleware.js";
import {
  toAuthorizationUserDataResponse,
  toAuthorizationUserListResponse,
} from "./authorization.mapper.js";
import {
  authorizationErrorResponseSchema,
  authorizationUserDataResponseSchema,
  authorizationUserListResponseSchema,
  changeUserRoleSchema,
  userRoleParamsSchema,
  userListQuerySchema,
} from "./authorization.schemas.js";

export interface AuthorizationHttpService {
  listUsers(input?: ListUsersInput): Promise<UserListResult>;
  changeUserRole(
    userId: string,
    role: AuthorizationUserSummary["role"],
  ): Promise<AuthorizationUserSummary>;
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

const changeUserRoleRoute = createRoute({
  method: "patch",
  path: "/{id}/role",
  tags: ["Authorization"],
  security: [{ sessionCookie: [] }],
  request: {
    params: userRoleParamsSchema,
    body: {
      content: { "application/json": { schema: changeUserRoleSchema } },
      required: true,
    },
  },
  responses: {
    200: {
      content: {
        "application/json": { schema: authorizationUserDataResponseSchema },
      },
      description: "User role updated",
    },
    400: {
      content: {
        "application/json": { schema: authorizationErrorResponseSchema },
      },
      description: "Invalid user ID or role",
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
    404: {
      content: {
        "application/json": { schema: authorizationErrorResponseSchema },
      },
      description: "User not found",
    },
    409: {
      content: {
        "application/json": { schema: authorizationErrorResponseSchema },
      },
      description: "The last administrator cannot be demoted",
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
  routes.use("/:id/role", authMiddleware);
  routes.use("/:id/role", createAuthorizationMiddleware("users:role:update"));
  routes.openapi(changeUserRoleRoute, async (context) => {
    const { id } = context.req.valid("param");
    const { role } = context.req.valid("json");
    const user = await service.changeUserRole(id, role);

    return context.json(toAuthorizationUserDataResponse(user), 200);
  });
  routes.onError((error, context) => {
    if (error instanceof AuthorizationUserNotFoundError) {
      return context.json(
        { error: { code: "USER_NOT_FOUND", message: error.message } },
        404,
      );
    }

    if (error instanceof LastAdminRoleChangeError) {
      return context.json(
        { error: { code: "LAST_ADMIN_ROLE_CHANGE", message: error.message } },
        409,
      );
    }

    return errorHandler(error, context);
  });

  return routes;
}
