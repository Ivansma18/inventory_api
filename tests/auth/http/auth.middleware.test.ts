import { randomUUID } from "node:crypto";

import { Hono } from "hono";
import { afterEach, describe, expect, it } from "vitest";

import { createAuthRoutes } from "../../../src/features/auth/http/auth.routes.js";
import {
  authMiddleware,
  type AuthMiddlewareEnv,
} from "../../../src/shared/middlewares/auth.middleware.js";
import { prisma } from "../../../src/shared/database/prisma.js";

const authRoutes = new Hono().route("/api/auth", createAuthRoutes());
const protectedApp = new Hono<AuthMiddlewareEnv>();
protectedApp.use("/protected", authMiddleware);
protectedApp.get("/protected", (context) => context.json(context.get("auth")));

let createdUserIds: string[] = [];

afterEach(async () => {
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  createdUserIds = [];
});

async function createSessionCookie() {
  const email = `${randomUUID()}@example.com`;
  const response = await authRoutes.request("/api/auth/sign-up/email", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: "Middleware user",
      email,
      password: "valid-password-123",
    }),
  });
  const body = await response.json();
  createdUserIds.push(body.data.user.id);

  return response.headers.get("set-cookie")!.split(";")[0];
}

describe("Authentication middleware", () => {
  it("rejects requests without a session using the standard unauthorized error", async () => {
    const response = await protectedApp.request("/protected");

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication required",
      },
    });
  });

  it("rejects manipulated cookies and does not expose auth errors", async () => {
    const response = await protectedApp.request("/protected", {
      headers: { cookie: "better-auth.session_token=invalid" },
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "UNAUTHORIZED" },
    });
  });

  it("injects the public identity for a valid session", async () => {
    const cookie = await createSessionCookie();

    const response = await protectedApp.request("/protected", {
      headers: { cookie },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      id: expect.any(String),
      email: expect.stringMatching(/@example\.com$/),
    });
  });

  it("rejects a cookie after its session is closed", async () => {
    const cookie = await createSessionCookie();
    const signOutResponse = await authRoutes.request("/api/auth/sign-out", {
      method: "POST",
      headers: { cookie },
    });

    expect(signOutResponse.status).toBe(204);

    const response = await protectedApp.request("/protected", {
      headers: { cookie },
    });

    expect(response.status).toBe(401);
  });
});
