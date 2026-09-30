import { z } from "@hono/zod-openapi";

import { authorizationRoles } from "../domain/authorization.policy.js";

export const userListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1).openapi({ example: 1 }),
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(100)
      .default(15)
      .openapi({ example: 15 }),
  })
  .strip()
  .openapi("AuthorizationUserListQuery");

export const userRoleParamsSchema = z
  .object({
    id: z
      .string()
      .min(1)
      .openapi({
        param: { name: "id", in: "path" },
        example: "user-id",
      }),
  })
  .openapi("AuthorizationUserRoleParams");

export const changeUserRoleSchema = z
  .object({
    role: z.enum(authorizationRoles).openapi({ example: "MANAGER" }),
  })
  .strip()
  .openapi("ChangeUserRoleRequest");

export const authorizationUserSummarySchema = z
  .object({
    id: z.string(),
    email: z.string().email(),
    role: z.enum(authorizationRoles),
  })
  .openapi("AuthorizationUserSummary");

export const authorizationUserDataResponseSchema = z
  .object({ data: authorizationUserSummarySchema })
  .openapi("AuthorizationUserDataResponse");

export const authorizationUserListResponseSchema = z
  .object({
    data: z.array(authorizationUserSummarySchema),
    pagination: z.object({
      total: z.number().int().min(0),
      page: z.number().int().min(1),
      limit: z.number().int().min(1).max(100),
    }),
  })
  .openapi("AuthorizationUserListResponse");

export const authorizationErrorResponseSchema = z
  .object({
    error: z.object({
      code: z.string(),
      message: z.string(),
    }),
  })
  .openapi("AuthorizationErrorResponse");
