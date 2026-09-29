import { randomUUID } from "node:crypto";

import { afterEach, describe, expect, it } from "vitest";

import { auth } from "../../../src/features/auth/auth.config.js";
import { prisma } from "../../../src/shared/database/prisma.js";

const rawPassword = "valid-password-123";
let createdUserIds: string[] = [];

afterEach(async () => {
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  createdUserIds = [];
});

describe("Better Auth configuration", () => {
  it("normalizes email, auto-signs in, and stores a protected password", async () => {
    const email = `${randomUUID()}@example.com`;

    const result = await auth.api.signUpEmail({
      body: {
        name: "Auth config user",
        email: `  ${email.toUpperCase()}  `,
        password: rawPassword,
      },
    });

    createdUserIds.push(result.user.id);

    expect(result.user.email).toBe(email);
    expect(result.token).toEqual(expect.any(String));
    const session = await prisma.session.findFirstOrThrow({
      where: { userId: result.user.id },
    });

    expect(session).toMatchObject({
      userId: result.user.id,
      token: expect.any(String),
    });

    const account = await prisma.account.findFirstOrThrow({
      where: { userId: result.user.id, providerId: "credential" },
    });

    expect(account.password).toEqual(expect.any(String));
    expect(account.password).not.toBe(rawPassword);
    expect(account.password).not.toContain(rawPassword);
    expect(
      (
        await prisma.user.findUniqueOrThrow({
          where: { id: result.user.id },
        })
      ).emailVerified,
    ).toBe(false);
  });

  it("rejects passwords shorter than eight characters", async () => {
    await expect(
      auth.api.signUpEmail({
        body: {
          name: "Invalid password user",
          email: `${randomUUID()}@example.com`,
          password: "short",
        },
      }),
    ).rejects.toThrow();
  });

  it("configures sessions with a maximum lifetime of 400 days", async () => {
    const email = `${randomUUID()}@example.com`;
    const result = await auth.api.signUpEmail({
      body: {
        name: "Long-lived session user",
        email,
        password: rawPassword,
      },
    });
    createdUserIds.push(result.user.id);

    const session = await prisma.session.findFirstOrThrow({
      where: { userId: result.user.id },
    });
    const lifetime = session.expiresAt.getTime() - Date.now();
    const maxLifetime = 400 * 24 * 60 * 60 * 1000;

    expect(lifetime).toBeGreaterThan(maxLifetime - 60_000);
    expect(lifetime).toBeLessThanOrEqual(maxLifetime);
  });
});
