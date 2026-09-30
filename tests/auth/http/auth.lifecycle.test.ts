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

describe("Authentication lifecycle with PostgreSQL", () => {
  it("persists normalized credentials, ignores unknown fields, and completes the public session lifecycle", async () => {
    const email = `${randomUUID()}@example.com`;
    const registration = await app.request("/api/auth/sign-up/email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Lifecycle user",
        email: `  ${email.toUpperCase()}  `,
        password,
        role: "ADMIN",
        ignored: "registration field",
      }),
    });

    expect(registration.status).toBe(201);
    const registered = await registration.json();
    createdUserIds.push(registered.data.user.id);
    expect(registered).toEqual({
      data: {
        user: { id: registered.data.user.id, email, role: "VIEWER" },
        session: {
          id: expect.any(String),
          createdAt: expect.any(String),
        },
      },
    });

    const persistedUser = await prisma.user.findUniqueOrThrow({
      where: { id: registered.data.user.id },
      include: { accounts: true, sessions: true },
    });
    expect(persistedUser.email).toBe(email);
    expect(persistedUser.role).toBe("VIEWER");
    expect(persistedUser.accounts).toHaveLength(1);
    expect(persistedUser.accounts[0].password).not.toBe(password);
    expect(persistedUser.accounts[0].password).not.toContain(password);
    expect(persistedUser.sessions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: registered.data.session.id }),
      ]),
    );

    const login = await app.request("/api/auth/sign-in/email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        ignored: "login field",
      }),
    });
    expect(login.status).toBe(200);
    const loginBody = await login.json();
    expect(loginBody.data.user).toEqual({
      id: registered.data.user.id,
      email,
      role: "VIEWER",
    });
    expect(Object.keys(loginBody.data.session)).toEqual(["id", "createdAt"]);

    const session = await app.request(
      "/api/auth/get-session?ignored=session-field",
      { headers: { cookie: cookieFrom(login) } },
    );
    expect(session.status).toBe(200);
    await expect(session.json()).resolves.toEqual({
      data: {
        user: { id: registered.data.user.id, email, role: "VIEWER" },
        session: {
          id: loginBody.data.session.id,
          createdAt: expect.any(String),
        },
      },
    });

    const signOut = await app.request("/api/auth/sign-out", {
      method: "POST",
      headers: { cookie: cookieFrom(login) },
    });
    expect(signOut.status).toBe(204);
  });

  it("rejects normalized duplicate emails and invalid registration or login input", async () => {
    const email = `${randomUUID()}@example.com`;
    const registration = await app.request("/api/auth/sign-up/email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Duplicate user", email, password }),
    });
    const registered = await registration.json();
    createdUserIds.push(registered.data.user.id);

    const [duplicate, invalidRegistration, invalidLogin] = await Promise.all([
      app.request("/api/auth/sign-up/email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Duplicate user",
          email: ` ${email.toUpperCase()} `,
          password,
        }),
      }),
      app.request("/api/auth/sign-up/email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Invalid user",
          email: "invalid-email",
          password: "short",
        }),
      }),
      app.request("/api/auth/sign-in/email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password: "wrong-password" }),
      }),
    ]);

    expect(duplicate.status).toBe(409);
    await expect(duplicate.json()).resolves.toEqual({
      error: {
        code: "EMAIL_ALREADY_REGISTERED",
        message: expect.any(String),
      },
    });
    expect(invalidRegistration.status).toBe(400);
    expect(invalidLogin.status).toBe(401);
    await expect(invalidLogin.json()).resolves.toEqual({
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication required",
      },
    });
  });

  it("requires a name field but accepts an empty name without additional validation rules", async () => {
    const [missingName, emptyName] = await Promise.all([
      app.request("/api/auth/sign-up/email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: `${randomUUID()}@example.com`,
          password,
        }),
      }),
      app.request("/api/auth/sign-up/email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "",
          email: `${randomUUID()}@example.com`,
          password,
        }),
      }),
    ]);

    expect(missingName.status).toBe(400);
    expect(emptyName.status).toBe(201);
    const emptyNameBody = await emptyName.json();
    createdUserIds.push(emptyNameBody.data.user.id);
    await expect(
      prisma.user.findUnique({
        where: { id: emptyNameBody.data.user.id },
        select: { name: true },
      }),
    ).resolves.toEqual({ name: "" });
  });

  it("returns the standard internal error when registration persistence fails", async () => {
    const suffix = randomUUID().replaceAll("-", "");
    const triggerName = `auth_registration_failure_${suffix}`;
    const functionName = `${triggerName}_function`;

    try {
      await prisma.$executeRawUnsafe(`
        CREATE FUNCTION "${functionName}"() RETURNS trigger AS $$
        BEGIN
          RAISE EXCEPTION 'Authentication persistence failed';
        END;
        $$ LANGUAGE plpgsql;
      `);
      await prisma.$executeRawUnsafe(`
        CREATE TRIGGER "${triggerName}"
        BEFORE INSERT ON "user"
        FOR EACH ROW EXECUTE FUNCTION "${functionName}"();
      `);

      const response = await app.request("/api/auth/sign-up/email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Persistence failure user",
          email: `${randomUUID()}@example.com`,
          password,
        }),
      });

      expect(response.status).toBe(500);
      await expect(response.json()).resolves.toEqual({
        error: {
          code: "INTERNAL_ERROR",
          message: "An unexpected error occurred.",
        },
      });
    } finally {
      await prisma.$executeRawUnsafe(
        `DROP TRIGGER IF EXISTS "${triggerName}" ON "user"`,
      );
      await prisma.$executeRawUnsafe(
        `DROP FUNCTION IF EXISTS "${functionName}"()`,
      );
    }
  });
});
