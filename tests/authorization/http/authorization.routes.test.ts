import { randomUUID } from "node:crypto";

import { OpenAPIHono } from "@hono/zod-openapi";
import { afterEach, describe, expect, it } from "vitest";

import { createAuthRoutes } from "../../../src/features/auth/http/auth.routes.js";
import type { ListUsersInput } from "../../../src/features/authorization/application/authorization.service.js";
import {
  AuthorizationUserNotFoundError,
  LastAdminRoleChangeError,
} from "../../../src/features/authorization/domain/authorization.errors.js";
import type { AuthorizationUserSummary } from "../../../src/features/authorization/domain/authorization.repository.js";
import {
  createAuthorizationRoutes,
  type AuthorizationHttpService,
} from "../../../src/features/authorization/http/authorization.routes.js";
import { prisma } from "../../../src/shared/database/prisma.js";
import {
  authMiddleware,
  type AuthMiddlewareEnv,
} from "../../../src/shared/middlewares/auth.middleware.js";

const createdUserIds: string[] = [];

afterEach(async () => {
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  createdUserIds.length = 0;
});

function createService(
  receivedInputs: ListUsersInput[] = [],
  changeUserRole: (
    userId: string,
    role: AuthorizationUserSummary["role"],
  ) => Promise<AuthorizationUserSummary> = async (userId, role) => ({
    id: userId,
    email: "updated@example.com",
    role,
  }),
): AuthorizationHttpService {
  const users = [
    {
      id: "user-1",
      email: "admin@example.com",
      role: "ADMIN",
      name: "Private user name",
    } as unknown as AuthorizationUserSummary,
  ];

  return {
    async listUsers(input) {
      receivedInputs.push(input ?? {});

      return { users, total: 42 };
    },
    changeUserRole,
  };
}

function createApp(service: AuthorizationHttpService) {
  const app = new OpenAPIHono<AuthMiddlewareEnv>();
  app.route("/api/auth", createAuthRoutes());
  app.route("/users", createAuthorizationRoutes({ service, authMiddleware }));
  app.openAPIRegistry.registerComponent("securitySchemes", "sessionCookie", {
    type: "apiKey",
    in: "cookie",
    name: "better-auth.session_token",
    description: "Better Auth session cookie.",
  });
  app.doc("/openapi.json", {
    openapi: "3.0.3",
    info: { title: "Authorization test API", version: "0.1.0" },
  });

  return app;
}

async function createSessionCookie(
  app: OpenAPIHono<AuthMiddlewareEnv>,
  role: "ADMIN" | "VIEWER" = "VIEWER",
): Promise<string> {
  const email = `${randomUUID()}@example.com`;
  const response = await app.request("/api/auth/sign-up/email", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: "Authorization route user",
      email,
      password: "valid-password-123",
    }),
  });

  expect(response.status).toBe(201);
  const body = (await response.json()) as { data: { user: { id: string } } };
  createdUserIds.push(body.data.user.id);

  if (role === "ADMIN") {
    await prisma.user.update({
      where: { id: body.data.user.id },
      data: { role: "ADMIN" },
    });
  }

  return response.headers.get("set-cookie")!.split(";")[0]!;
}

describe("Authorization user routes", () => {
  it("lists public user summaries with default and requested pagination", async () => {
    const receivedInputs: ListUsersInput[] = [];
    const app = createApp(createService(receivedInputs));
    const cookie = await createSessionCookie(app, "ADMIN");

    const defaults = await app.request("/users", { headers: { cookie } });
    const requestedPage = await app.request("/users?page=2&limit=100", {
      headers: { cookie },
    });

    expect(defaults.status).toBe(200);
    await expect(defaults.json()).resolves.toEqual({
      data: [{ id: "user-1", email: "admin@example.com", role: "ADMIN" }],
      pagination: { total: 42, page: 1, limit: 15 },
    });
    expect(requestedPage.status).toBe(200);
    await expect(requestedPage.json()).resolves.toEqual({
      data: [{ id: "user-1", email: "admin@example.com", role: "ADMIN" }],
      pagination: { total: 42, page: 2, limit: 100 },
    });
    expect(receivedInputs).toEqual([
      { page: 1, limit: 15 },
      { page: 2, limit: 100 },
    ]);
  });

  it("returns 401 without a valid session", async () => {
    const app = createApp(createService());

    const response = await app.request("/users");

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: { code: "UNAUTHORIZED", message: "Authentication required" },
    });
  });

  it("returns 403 to an authenticated non-admin without listing users", async () => {
    const receivedInputs: ListUsersInput[] = [];
    const app = createApp(createService(receivedInputs));
    const cookie = await createSessionCookie(app, "VIEWER");

    const response = await app.request("/users", { headers: { cookie } });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "FORBIDDEN",
        message: "You do not have permission to perform this operation.",
      },
    });
    expect(receivedInputs).toEqual([]);
  });

  it("returns 400 for invalid pagination values", async () => {
    const receivedInputs: ListUsersInput[] = [];
    const app = createApp(createService(receivedInputs));
    const cookie = await createSessionCookie(app, "ADMIN");
    const invalidQueries = [
      "?page=0",
      "?page=1.5",
      "?page=invalid",
      "?limit=0",
      "?limit=1.5",
      "?limit=101",
    ];

    const responses = await Promise.all(
      invalidQueries.map((query) =>
        app.request(`/users${query}`, { headers: { cookie } }),
      ),
    );

    expect(responses.map(({ status }) => status)).toEqual(
      invalidQueries.map(() => 400),
    );
    await expect(responses[0]?.json()).resolves.toEqual({
      error: {
        code: "VALIDATION_ERROR",
        message: "Request validation failed.",
      },
    });
    expect(receivedInputs).toEqual([]);
  });

  it("updates a user's role and returns only the public summary", async () => {
    const targetUserId = "managed-user-id";
    const receivedChanges: Array<{ userId: string; role: string }> = [];
    const app = createApp(
      createService([], async (userId, role) => {
        receivedChanges.push({ userId, role });

        return {
          id: userId,
          email: "managed@example.com",
          role,
          name: "Private name",
        } as unknown as AuthorizationUserSummary;
      }),
    );
    const cookie = await createSessionCookie(app, "ADMIN");

    const response = await app.request(`/users/${targetUserId}/role`, {
      method: "PATCH",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ role: "MANAGER", ignored: "field" }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: {
        id: targetUserId,
        email: "managed@example.com",
        role: "MANAGER",
      },
    });
    expect(receivedChanges).toEqual([
      { userId: targetUserId, role: "MANAGER" },
    ]);
  });

  it("returns 400 for an unknown role without calling the service", async () => {
    const receivedChanges: Array<{ userId: string; role: string }> = [];
    const app = createApp(
      createService([], async (userId, role) => {
        receivedChanges.push({ userId, role });

        return { id: userId, email: "user@example.com", role };
      }),
    );
    const cookie = await createSessionCookie(app, "ADMIN");

    const response = await app.request("/users/managed-user-id/role", {
      method: "PATCH",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ role: "SUPERADMIN" }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "VALIDATION_ERROR",
        message: "Request validation failed.",
      },
    });
    expect(receivedChanges).toEqual([]);
  });

  it("returns 401 without a session and 403 for a non-admin", async () => {
    const receivedChanges: Array<{ userId: string; role: string }> = [];
    const app = createApp(
      createService([], async (userId, role) => {
        receivedChanges.push({ userId, role });

        return { id: userId, email: "user@example.com", role };
      }),
    );
    const unauthenticated = await app.request("/users/managed-user-id/role", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role: "VIEWER" }),
    });
    const viewerCookie = await createSessionCookie(app, "VIEWER");
    const forbidden = await app.request("/users/managed-user-id/role", {
      method: "PATCH",
      headers: {
        cookie: viewerCookie,
        "content-type": "application/json",
      },
      body: JSON.stringify({ role: "VIEWER" }),
    });

    expect(unauthenticated.status).toBe(401);
    await expect(unauthenticated.json()).resolves.toEqual({
      error: { code: "UNAUTHORIZED", message: "Authentication required" },
    });
    expect(forbidden.status).toBe(403);
    await expect(forbidden.json()).resolves.toEqual({
      error: {
        code: "FORBIDDEN",
        message: "You do not have permission to perform this operation.",
      },
    });
    expect(receivedChanges).toEqual([]);
  });

  it("translates missing users and last-admin role changes", async () => {
    const notFoundApp = createApp(
      createService([], async () => {
        throw new AuthorizationUserNotFoundError();
      }),
    );
    const conflictApp = createApp(
      createService([], async () => {
        throw new LastAdminRoleChangeError();
      }),
    );
    const notFoundCookie = await createSessionCookie(notFoundApp, "ADMIN");
    const conflictCookie = await createSessionCookie(conflictApp, "ADMIN");
    const [notFound, conflict] = await Promise.all([
      notFoundApp.request("/users/missing-user/role", {
        method: "PATCH",
        headers: {
          cookie: notFoundCookie,
          "content-type": "application/json",
        },
        body: JSON.stringify({ role: "MANAGER" }),
      }),
      conflictApp.request("/users/last-admin/role", {
        method: "PATCH",
        headers: {
          cookie: conflictCookie,
          "content-type": "application/json",
        },
        body: JSON.stringify({ role: "VIEWER" }),
      }),
    ]);

    expect(notFound.status).toBe(404);
    await expect(notFound.json()).resolves.toEqual({
      error: { code: "USER_NOT_FOUND", message: "User was not found." },
    });
    expect(conflict.status).toBe(409);
    await expect(conflict.json()).resolves.toEqual({
      error: {
        code: "LAST_ADMIN_ROLE_CHANGE",
        message: "The last ADMIN cannot be demoted.",
      },
    });
  });

  it("documents query defaults, response fields, security, and errors in OpenAPI", async () => {
    const app = createApp(createService());

    const response = await app.request("/openapi.json");
    expect(response.status).toBe(200);
    const document = await response.json();
    const operation = document.paths["/users"].get;

    expect(operation).toMatchObject({
      security: [{ sessionCookie: [] }],
      responses: {
        200: expect.anything(),
        400: expect.anything(),
        401: expect.anything(),
        403: expect.anything(),
      },
    });
    expect(operation.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "page", in: "query" }),
        expect.objectContaining({ name: "limit", in: "query" }),
      ]),
    );
    const pageParameter = operation.parameters.find(
      (parameter: { name: string }) => parameter.name === "page",
    );
    const limitParameter = operation.parameters.find(
      (parameter: { name: string }) => parameter.name === "limit",
    );
    expect(pageParameter).toMatchObject({
      required: false,
      schema: { minimum: 1, default: 1 },
    });
    expect(limitParameter).toMatchObject({
      required: false,
      schema: { minimum: 1, maximum: 100, default: 15 },
    });
    expect(document.components.schemas.AuthorizationUserSummary).toMatchObject({
      properties: {
        id: { type: "string" },
        email: { type: "string", format: "email" },
        role: {
          type: "string",
          enum: ["ADMIN", "MANAGER", "OPERATOR", "VIEWER"],
        },
      },
    });
    expect(
      Object.keys(
        document.components.schemas.AuthorizationUserSummary.properties,
      ).sort(),
    ).toEqual(["email", "id", "role"]);
    expect(
      document.components.schemas.AuthorizationUserListResponse.properties,
    ).toMatchObject({
      data: {
        type: "array",
        items: { $ref: "#/components/schemas/AuthorizationUserSummary" },
      },
      pagination: {
        properties: {
          total: { type: "integer", minimum: 0 },
          page: { type: "integer", minimum: 1 },
          limit: { type: "integer", minimum: 1, maximum: 100 },
        },
      },
    });

    const updateRoleOperation = document.paths["/users/{id}/role"].patch;
    expect(updateRoleOperation).toMatchObject({
      security: [{ sessionCookie: [] }],
      parameters: [expect.objectContaining({ name: "id", in: "path" })],
      requestBody: { required: true },
      responses: {
        200: expect.anything(),
        400: expect.anything(),
        401: expect.anything(),
        403: expect.anything(),
        404: expect.anything(),
        409: expect.anything(),
      },
    });
    expect(document.components.schemas.ChangeUserRoleRequest).toMatchObject({
      required: ["role"],
      properties: {
        role: {
          type: "string",
          enum: ["ADMIN", "MANAGER", "OPERATOR", "VIEWER"],
        },
      },
    });
  });
});
