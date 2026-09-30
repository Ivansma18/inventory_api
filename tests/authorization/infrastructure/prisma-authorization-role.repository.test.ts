import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PrismaPg } from "@prisma/adapter-pg";
import { Client } from "pg";

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { PrismaClient } from "../../../src/generated/prisma/client.js";
import {
  AuthorizationUserNotFoundError,
  LastAdminRoleChangeError,
} from "../../../src/features/authorization/domain/authorization.errors.js";
import type { UserRole } from "../../../src/features/authorization/domain/authorization.policy.js";
import { PrismaAuthorizationRepository } from "../../../src/features/authorization/infrastructure/prisma-authorization.repository.js";
import { env } from "../../../src/shared/config/env.js";

const authenticationMigrationSql = readFileSync(
  fileURLToPath(
    new URL(
      "../../../prisma/migrations/20260925190000_add_authentication/migration.sql",
      import.meta.url,
    ),
  ),
  "utf8",
);
const authorizationRoleMigrationSql = readFileSync(
  fileURLToPath(
    new URL(
      "../../../prisma/migrations/20260929170000_add_authorization_role/migration.sql",
      import.meta.url,
    ),
  ),
  "utf8",
);
const schema = `authorization_role_change_${randomUUID().replaceAll("-", "")}`;

let migrationClient: Client | undefined;
let isolatedPrisma: PrismaClient | undefined;
let repository: PrismaAuthorizationRepository;

beforeAll(async () => {
  migrationClient = new Client({ connectionString: env.DATABASE_URL });
  await migrationClient.connect();
  await migrationClient.query(`CREATE SCHEMA "${schema}"`);
  await migrationClient.query(`SET search_path TO "${schema}"`);
  await migrationClient.query(authenticationMigrationSql);
  await migrationClient.query(authorizationRoleMigrationSql);

  isolatedPrisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: env.DATABASE_URL }, { schema }),
  });
  repository = new PrismaAuthorizationRepository(isolatedPrisma);
}, 30_000);

beforeEach(async () => {
  await getPrisma().user.deleteMany();
});

afterAll(async () => {
  await isolatedPrisma?.$disconnect();

  if (migrationClient) {
    try {
      await migrationClient.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    } finally {
      await migrationClient.end();
    }
  }
}, 30_000);

describe("PrismaAuthorizationRepository.changeUserRole", () => {
  it("persists a valid role change and returns the public user summary", async () => {
    const user = await createUser("VIEWER");

    await expect(
      repository.changeUserRole(user.id, "MANAGER"),
    ).resolves.toEqual({
      id: user.id,
      email: user.email,
      role: "MANAGER",
    });
    await expect(
      getPrisma().user.findUnique({
        where: { id: user.id },
        select: { role: true },
      }),
    ).resolves.toEqual({ role: "MANAGER" });
  });

  it("reports a missing user", async () => {
    await expect(
      repository.changeUserRole(randomUUID(), "MANAGER"),
    ).rejects.toThrow(AuthorizationUserNotFoundError);
  });

  it("rejects demoting the last ADMIN without changing the persisted role", async () => {
    const admin = await createUser("ADMIN");

    await expect(repository.changeUserRole(admin.id, "VIEWER")).rejects.toThrow(
      LastAdminRoleChangeError,
    );
    await expect(
      getPrisma().user.findUnique({
        where: { id: admin.id },
        select: { role: true },
      }),
    ).resolves.toEqual({ role: "ADMIN" });
  });

  it("allows an ADMIN to change their own role while another ADMIN remains", async () => {
    const actor = await createUser("ADMIN");
    const remainingAdmin = await createUser("ADMIN");

    await expect(
      repository.changeUserRole(actor.id, "MANAGER"),
    ).resolves.toEqual({
      id: actor.id,
      email: actor.email,
      role: "MANAGER",
    });
    await expect(
      getPrisma().user.findUnique({
        where: { id: remainingAdmin.id },
        select: { role: true },
      }),
    ).resolves.toEqual({ role: "ADMIN" });
  });
});

async function createUser(role: UserRole) {
  const id = randomUUID();

  return getPrisma().user.create({
    data: {
      id,
      name: `Authorization user ${id}`,
      email: `${id}@example.com`,
      role,
    },
    select: { id: true, email: true, role: true },
  });
}

function getPrisma(): PrismaClient {
  if (!isolatedPrisma) {
    throw new Error("The isolated authorization database is not initialized.");
  }

  return isolatedPrisma;
}
