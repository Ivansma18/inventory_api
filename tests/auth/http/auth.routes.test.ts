import { randomUUID } from "node:crypto";

import { Hono } from "hono";
import { afterEach, describe, expect, it } from "vitest";

import { createAuthRoutes } from "../../../src/features/auth/http/auth.routes.js";
import { prisma } from "../../../src/shared/database/prisma.js";

const app = new Hono().route("/api/auth", createAuthRoutes());
const password = "valid-password-123";
let createdEmails: string[] = [];

afterEach(async () => {
  await prisma.user.deleteMany({
    where: { email: { in: createdEmails } },
  });
  createdEmails = [];
});

function requestBody(email: string, extra: Record<string, unknown> = {}) {
  return JSON.stringify({
    name: "Route auth user",
    email,
    password,
    ...extra,
  });
}

function sessionCookie(response: Response): string {
  const setCookie = response.headers.get("set-cookie");
  expect(setCookie).toEqual(expect.any(String));
  return setCookie!.split(";")[0];
}

describe("Better Auth routes", () => {
  it("registers a user, creates a cookie, and returns the public response", async () => {
    const email = `${randomUUID()}@example.com`;
    createdEmails.push(email);

    const response = await app.request("/api/auth/sign-up/email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: requestBody(`  ${email.toUpperCase()}  `, {
        ignored: "field",
      }),
    });

    expect(response.status).toBe(201);
    const body = await response.json();

    expect(body).toEqual({
      data: {
        user: { id: expect.any(String), email },
        session: {
          id: expect.any(String),
          createdAt: expect.any(String),
        },
      },
    });
    expect(Object.keys(body.data.session)).toEqual(["id", "createdAt"]);
    expect(sessionCookie(response)).toEqual(expect.stringContaining("="));
  });

  it("rejects duplicate emails with the documented conflict", async () => {
    const email = `${randomUUID()}@example.com`;
    createdEmails.push(email);

    await app.request("/api/auth/sign-up/email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: requestBody(email),
    });

    const response = await app.request("/api/auth/sign-up/email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: requestBody(email),
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "EMAIL_ALREADY_REGISTERED" },
    });
  });

  it("logs in, reads the session, and signs out with the expected statuses", async () => {
    const email = `${randomUUID()}@example.com`;
    createdEmails.push(email);

    await app.request("/api/auth/sign-up/email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: requestBody(email),
    });

    const loginResponse = await app.request("/api/auth/sign-in/email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    expect(loginResponse.status).toBe(200);
    const cookie = sessionCookie(loginResponse);
    await expect(loginResponse.json()).resolves.toMatchObject({
      data: {
        user: { email },
        session: {
          id: expect.any(String),
          createdAt: expect.any(String),
        },
      },
    });

    const sessionResponse = await app.request("/api/auth/get-session", {
      headers: { cookie },
    });
    expect(sessionResponse.status).toBe(200);
    await expect(sessionResponse.json()).resolves.toMatchObject({
      data: { user: { email }, session: { id: expect.any(String) } },
    });

    const signOutResponse = await app.request("/api/auth/sign-out", {
      method: "POST",
      headers: { cookie },
    });
    expect(signOutResponse.status).toBe(204);
  });

  it("maps invalid credentials and invalid registration input to validation errors", async () => {
    const email = `${randomUUID()}@example.com`;

    const invalidRegistration = await app.request("/api/auth/sign-up/email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: requestBody("invalid-email", { password: "short" }),
    });
    expect(invalidRegistration.status).toBe(400);

    const invalidLogin = await app.request("/api/auth/sign-in/email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password: "wrong-password" }),
    });
    expect(invalidLogin.status).toBe(401);
    await expect(invalidLogin.json()).resolves.toMatchObject({
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication required",
      },
    });
  });
});
