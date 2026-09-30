import { randomUUID } from "node:crypto";

import { Hono } from "hono";
import { afterEach, describe, expect, it } from "vitest";

import { createAuthRoutes } from "../../../src/features/auth/http/auth.routes.js";
import { createAuthorizationMiddleware } from "../../../src/features/authorization/index.js";
import { prisma } from "../../../src/shared/database/prisma.js";
import {
  authMiddleware,
  type AuthMiddlewareEnv,
} from "../../../src/shared/middlewares/auth.middleware.js";

const authRoutes = new Hono().route("/api/auth", createAuthRoutes());
const protectedApp = new Hono<AuthMiddlewareEnv>();
protectedApp.use("*", authMiddleware);
protectedApp.use("*", createAuthorizationMiddleware("product:create"));
protectedApp.get("/protected", (context) => context.json(context.get("auth")));

let createdUserIds: string[] = [];

afterEach(async () => {
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  createdUserIds = [];
});

async function createSessionCookie(role: "VIEWER" | "ADMIN" = "VIEWER") {
  const email = `${randomUUID()}@example.com`;
  const response = await authRoutes.request("/api/auth/sign-up/email", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: "Authorization middleware user",
      email,
      password: "valid-password-123",
    }),
  });
  const body = await response.json();
  createdUserIds.push(body.data.user.id);

  if (role === "ADMIN") {
    await prisma.user.update({
      where: { id: body.data.user.id },
      data: { role: "ADMIN" },
    });
  }

  return response.headers.get("set-cookie")!.split(";")[0];
}

describe("Authorization middleware", () => {
  it("returns the standard unauthorized response before authorization without a session", async () => {
    const response = await protectedApp.request("/protected");

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication required",
      },
    });
  });

  it("forbids an authenticated user whose role lacks the permission", async () => {
    const cookie = await createSessionCookie();
    const response = await protectedApp.request("/protected", {
      headers: { cookie },
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "FORBIDDEN",
        message: "You do not have permission to perform this operation.",
      },
    });
  });

  it("continues when the authenticated role has the required permission", async () => {
    const cookie = await createSessionCookie("ADMIN");
    const response = await protectedApp.request("/protected", {
      headers: { cookie },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ role: "ADMIN" });
  });
});
