import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Client } from "pg";

import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "../../../src/shared/database/prisma.js";

const migrationPath = fileURLToPath(
  new URL(
    "../../../prisma/migrations/20260925190000_add_authentication/migration.sql",
    import.meta.url,
  ),
);
const migrationSql = readFileSync(migrationPath, "utf8");

let createdUserIds: string[] = [];
let createdVerificationIds: string[] = [];

afterEach(async () => {
  await prisma.verification.deleteMany({
    where: { id: { in: createdVerificationIds } },
  });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  createdUserIds = [];
  createdVerificationIds = [];
});

describe("Better Auth Prisma schema and migration", () => {
  it("creates the required tables, keys, and cascading user relations", async () => {
    const schema = `auth_migration_${randomUUID().replaceAll("-", "")}`;
    const client = new Client({ connectionString: process.env.DATABASE_URL });

    try {
      await client.connect();
      await client.query(`CREATE SCHEMA "${schema}"`);
      await client.query(`SET search_path TO "${schema}"`);
      await client.query(migrationSql);

      const { rows: tables } = await client.query<{ table_name: string }>(
        `SELECT table_name
         FROM information_schema.tables
         WHERE table_schema = $1
         ORDER BY table_name`,
        [schema],
      );
      expect(tables.map(({ table_name }) => table_name)).toEqual([
        "account",
        "session",
        "user",
        "verification",
      ]);

      const { rows: userColumns } = await client.query<{
        column_name: string;
      }>(
        `SELECT column_name
         FROM information_schema.columns
         WHERE table_schema = $1 AND table_name = 'user'
         ORDER BY column_name`,
        [schema],
      );
      expect(userColumns.map(({ column_name }) => column_name)).toEqual([
        "createdAt",
        "email",
        "emailVerified",
        "id",
        "image",
        "name",
        "updatedAt",
      ]);

      const { rows: indexes } = await client.query<{ indexname: string }>(
        `SELECT indexname
         FROM pg_indexes
         WHERE schemaname = $1`,
        [schema],
      );
      expect(indexes.map(({ indexname }) => indexname)).toEqual(
        expect.arrayContaining([
          "user_email_key",
          "session_token_key",
          "account_providerId_accountId_key",
        ]),
      );

      const { rows: foreignKeys } = await client.query<{
        conrelid: string;
        confdeltype: string;
      }>(
        `SELECT child.relname AS conrelid, constraint_info.confdeltype
         FROM pg_constraint constraint_info
         JOIN pg_class child ON child.oid = constraint_info.conrelid
         JOIN pg_namespace namespace_info ON namespace_info.oid = child.relnamespace
         WHERE constraint_info.contype = 'f' AND namespace_info.nspname = $1
         ORDER BY child.relname`,
        [schema],
      );
      expect(foreignKeys).toEqual([
        { conrelid: "account", confdeltype: "c" },
        { conrelid: "session", confdeltype: "c" },
      ]);
      expect(migrationSql).not.toMatch(/plaintext|createdBy/i);
    } finally {
      await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await client.end();
    }
  });

  it("persists auth records and cascades sessions and accounts with the user", async () => {
    const userId = randomUUID();
    const sessionId = randomUUID();
    const accountId = randomUUID();
    const verificationId = randomUUID();
    createdUserIds.push(userId);
    createdVerificationIds.push(verificationId);

    await prisma.user.create({
      data: {
        id: userId,
        name: "Auth user",
        email: `${userId}@example.com`,
        accounts: {
          create: {
            id: accountId,
            accountId: userId,
            providerId: "credential",
            password: "protected-password-value",
          },
        },
        sessions: {
          create: {
            id: sessionId,
            token: `session-token-${userId}`,
            expiresAt: new Date("9999-12-31T23:59:59.999Z"),
          },
        },
      },
    });

    await prisma.verification.create({
      data: {
        id: verificationId,
        identifier: `${userId}@example.com`,
        value: "verification-value",
        expiresAt: new Date("9999-12-31T23:59:59.999Z"),
      },
    });

    const persistedUser = await prisma.user.findUnique({
      where: { id: userId },
      include: { accounts: true, sessions: true },
    });

    expect(persistedUser).toMatchObject({
      id: userId,
      email: `${userId}@example.com`,
      accounts: [{ id: accountId, password: "protected-password-value" }],
      sessions: [{ id: sessionId, token: `session-token-${userId}` }],
    });

    await prisma.user.delete({ where: { id: userId } });

    await expect(
      prisma.account.findUnique({ where: { id: accountId } }),
    ).resolves.toBeNull();
    await expect(
      prisma.session.findUnique({ where: { id: sessionId } }),
    ).resolves.toBeNull();
  });
});
