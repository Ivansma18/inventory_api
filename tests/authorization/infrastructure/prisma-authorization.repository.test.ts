import { randomUUID } from "node:crypto";

import { afterEach, describe, expect, it } from "vitest";

import { PrismaAuthorizationRepository } from "../../../src/features/authorization/infrastructure/prisma-authorization.repository.js";
import { prisma } from "../../../src/shared/database/prisma.js";

const repository = new PrismaAuthorizationRepository(prisma);
let createdUserIds: string[] = [];

afterEach(async () => {
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  createdUserIds = [];
});

describe("PrismaAuthorizationRepository.findUsers", () => {
  it("paginates users, reports the total, and selects only public fields", async () => {
    const users = (["ADMIN", "MANAGER", "VIEWER"] as const).map((role) => {
      const id = `authorization-list-${randomUUID()}`;

      return {
        id,
        name: `Private name ${id}`,
        email: `${id}@example.com`,
        image: `https://example.com/${id}.png`,
        role,
      };
    });
    createdUserIds = users.map(({ id }) => id);

    await prisma.user.createMany({ data: users });

    const allUsers = await prisma.user.findMany({
      orderBy: { id: "asc" },
      select: { id: true, email: true, role: true },
    });
    const firstPage = await repository.findUsers({ page: 1, limit: 2 });
    const secondPage = await repository.findUsers({ page: 2, limit: 2 });
    const singleUserPage = await repository.findUsers({ page: 1, limit: 1 });
    const testUserIndex = allUsers.findIndex(({ id }) =>
      createdUserIds.includes(id),
    );
    expect(testUserIndex).toBeGreaterThanOrEqual(0);
    const testUserPage = await repository.findUsers({
      page: testUserIndex + 1,
      limit: 1,
    });

    expect(firstPage).toEqual({
      users: allUsers.slice(0, 2),
      total: allUsers.length,
    });
    expect(secondPage).toEqual({
      users: allUsers.slice(2, 4),
      total: allUsers.length,
    });
    expect(singleUserPage).toEqual({
      users: allUsers.slice(0, 1),
      total: allUsers.length,
    });
    expect(testUserPage).toEqual({
      users: [allUsers[testUserIndex]],
      total: allUsers.length,
    });
    expect(Object.keys(testUserPage.users[0] ?? {}).sort()).toEqual([
      "email",
      "id",
      "role",
    ]);
  });
});
