import { randomUUID } from "node:crypto";

import { afterEach, describe, expect, it } from "vitest";

import { app } from "../../../src/app.js";
import { prisma } from "../../../src/shared/database/prisma.js";

const createdUserIds: string[] = [];

afterEach(async () => {
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  createdUserIds.length = 0;
});

describe("Authorization composition", () => {
  it("requires manual ADMIN setup before enabling user administration", async () => {
    const unauthenticatedList = await app.request("/users");

    expect(unauthenticatedList.status).toBe(401);
    await expect(unauthenticatedList.json()).resolves.toEqual({
      error: { code: "UNAUTHORIZED", message: "Authentication required" },
    });

    const email = `${randomUUID()}@example.com`;
    const registration = await app.request("/api/auth/sign-up/email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Authorization bootstrap user",
        email,
        password: "valid-password-123",
      }),
    });
    expect(registration.status).toBe(201);
    const registrationBody = (await registration.json()) as {
      data: {
        user: { id: string; email: string; role: string };
        session: { id: string; createdAt: string };
      };
    };
    const administratorId = registrationBody.data.user.id;
    createdUserIds.push(administratorId);
    const cookie = registration.headers.get("set-cookie")!.split(";")[0]!;

    expect(registrationBody.data.user).toEqual({
      id: administratorId,
      email,
      role: "VIEWER",
    });
    expect(Object.keys(registrationBody.data.session).sort()).toEqual([
      "createdAt",
      "id",
    ]);

    const targetUserId = randomUUID();
    const targetUser = await prisma.user.create({
      data: {
        id: targetUserId,
        name: "Authorization role target",
        email: `${targetUserId}@example.com`,
        role: "VIEWER",
      },
      select: { id: true, email: true, role: true },
    });
    createdUserIds.push(targetUser.id);

    const viewerList = await app.request("/users", { headers: { cookie } });
    const viewerRoleChange = await app.request(`/users/${targetUser.id}/role`, {
      method: "PATCH",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ role: "MANAGER" }),
    });

    expect(viewerList.status).toBe(403);
    expect(viewerRoleChange.status).toBe(403);

    await prisma.user.update({
      where: { id: administratorId },
      data: { role: "ADMIN" },
    });

    const session = await app.request("/api/auth/get-session", {
      headers: { cookie },
    });
    expect(session.status).toBe(200);
    await expect(session.json()).resolves.toMatchObject({
      data: { user: { id: administratorId, email, role: "ADMIN" } },
    });

    const administratorList = await app.request("/users", {
      headers: { cookie },
    });
    const totalUsers = await prisma.user.count();
    expect(administratorList.status).toBe(200);
    const listBody = await administratorList.json();
    expect(listBody).toMatchObject({
      data: expect.any(Array),
      pagination: { total: totalUsers, page: 1, limit: 15 },
    });
    expect(
      listBody.data.every(
        (user: Record<string, unknown>) =>
          Object.keys(user).sort().join(",") === "email,id,role",
      ),
    ).toBe(true);

    const roleChange = await app.request(`/users/${targetUser.id}/role`, {
      method: "PATCH",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ role: "MANAGER" }),
    });

    expect(roleChange.status).toBe(200);
    await expect(roleChange.json()).resolves.toEqual({
      data: {
        id: targetUser.id,
        email: targetUser.email,
        role: "MANAGER",
      },
    });

    const signOut = await app.request("/api/auth/sign-out", {
      method: "POST",
      headers: { cookie },
    });
    expect(signOut.status).toBe(204);
  });
});
