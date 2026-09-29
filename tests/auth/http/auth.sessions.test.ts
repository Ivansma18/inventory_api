import { randomUUID } from "node:crypto";

import { afterEach, describe, expect, it } from "vitest";

import { app } from "../../../src/app.js";
import { prisma } from "../../../src/shared/database/prisma.js";

const password = "valid-password-123";
let createdUserIds: string[] = [];

afterEach(async () => {
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  createdUserIds = [];
});

function cookieFrom(response: Response): string {
  const setCookie = response.headers.get("set-cookie");
  expect(setCookie).toEqual(expect.any(String));

  return setCookie!.split(";")[0];
}

async function registerUser() {
  const email = `${randomUUID()}@example.com`;
  const response = await app.request("/api/auth/sign-up/email", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "Session user", email, password }),
  });

  expect(response.status).toBe(201);
  const body = await response.json();
  createdUserIds.push(body.data.user.id);

  return { email, body, cookie: cookieFrom(response) };
}

describe("Authentication sessions with PostgreSQL", () => {
  it("invalidates only the current session and preserves other active sessions", async () => {
    const registration = await registerUser();
    const login = await app.request("/api/auth/sign-in/email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: registration.email, password }),
    });
    expect(login.status).toBe(200);
    const loginBody = await login.json();
    const secondCookie = cookieFrom(login);

    const [firstSession, secondSession] = await Promise.all([
      app.request("/api/auth/get-session", {
        headers: { cookie: registration.cookie },
      }),
      app.request("/api/auth/get-session", {
        headers: { cookie: secondCookie },
      }),
    ]);
    expect(firstSession.status).toBe(200);
    expect(secondSession.status).toBe(200);

    const signOut = await app.request("/api/auth/sign-out", {
      method: "POST",
      headers: { cookie: registration.cookie },
    });
    expect(signOut.status).toBe(204);

    const [closedSession, preservedSession] = await Promise.all([
      app.request("/api/auth/get-session", {
        headers: { cookie: registration.cookie },
      }),
      app.request("/api/auth/get-session", {
        headers: { cookie: secondCookie },
      }),
    ]);
    expect(closedSession.status).toBe(401);
    expect(preservedSession.status).toBe(200);
    await expect(
      prisma.session.findMany({
        where: { userId: registration.body.data.user.id },
        select: { id: true },
      }),
    ).resolves.toEqual([{ id: loginBody.data.session.id }]);
  });

  it("rejects absent, manipulated, and expired session cookies while sign-out stays idempotent", async () => {
    const registration = await registerUser();
    await prisma.session.update({
      where: { id: registration.body.data.session.id },
      data: { expiresAt: new Date(Date.now() - 1) },
    });

    const [absent, manipulated, expired, signOutWithoutSession] =
      await Promise.all([
        app.request("/api/auth/get-session"),
        app.request("/api/auth/get-session", {
          headers: { cookie: "better-auth.session_token=invalid" },
        }),
        app.request("/api/auth/get-session", {
          headers: { cookie: registration.cookie },
        }),
        app.request("/api/auth/sign-out", { method: "POST" }),
      ]);

    for (const response of [absent, manipulated, expired]) {
      expect(response.status).toBe(401);
      await expect(response.json()).resolves.toEqual({
        error: {
          code: "UNAUTHORIZED",
          message: "Authentication required",
        },
      });
    }
    expect(signOutWithoutSession.status).toBe(204);
  });
});
