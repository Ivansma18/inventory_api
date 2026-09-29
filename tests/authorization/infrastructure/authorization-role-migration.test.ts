import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Client } from "pg";

import { describe, expect, it } from "vitest";

import { env } from "../../../src/shared/config/env.js";

const authenticationMigrationPath = fileURLToPath(
  new URL(
    "../../../prisma/migrations/20260925190000_add_authentication/migration.sql",
    import.meta.url,
  ),
);
const authorizationRoleMigrationPath = fileURLToPath(
  new URL(
    "../../../prisma/migrations/20260929170000_add_authorization_role/migration.sql",
    import.meta.url,
  ),
);
const authenticationMigrationSql = readFileSync(
  authenticationMigrationPath,
  "utf8",
);

describe("Authorization role migration", () => {
  it("backfills existing users and defaults new users to VIEWER", async () => {
    const schema = `authorization_role_${randomUUID().replaceAll("-", "")}`;
    const client = new Client({ connectionString: env.DATABASE_URL });
    const existingUserId = randomUUID();
    const existingEmail = `${existingUserId}@example.com`;
    const newUserId = randomUUID();
    const newEmail = `${newUserId}@example.com`;

    try {
      await client.connect();
      await client.query(`CREATE SCHEMA "${schema}"`);
      await client.query(`SET search_path TO "${schema}"`);
      await client.query(authenticationMigrationSql);
      await client.query(
        `INSERT INTO "user" ("id", "name", "email", "updatedAt")
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
        [existingUserId, "Existing user", existingEmail],
      );

      const authorizationRoleMigrationSql = readFileSync(
        authorizationRoleMigrationPath,
        "utf8",
      );
      await client.query(authorizationRoleMigrationSql);

      const { rows: roleValues } = await client.query<{
        enumlabel: string;
      }>(`SELECT enumlabel
          FROM pg_enum
          WHERE enumtypid = '"UserRole"'::regtype
          ORDER BY enumsortorder`);
      expect(roleValues.map(({ enumlabel }) => enumlabel)).toEqual([
        "ADMIN",
        "MANAGER",
        "OPERATOR",
        "VIEWER",
      ]);

      const { rows: existingUsers } = await client.query<{
        role: string;
      }>(`SELECT "role" FROM "user" WHERE "id" = $1`, [existingUserId]);
      expect(existingUsers).toEqual([{ role: "VIEWER" }]);

      await client.query(
        `INSERT INTO "user" ("id", "name", "email", "updatedAt")
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
        [newUserId, "New user", newEmail],
      );
      const { rows: newUsers } = await client.query<{
        role: string;
      }>(`SELECT "role" FROM "user" WHERE "id" = $1`, [newUserId]);
      expect(newUsers).toEqual([{ role: "VIEWER" }]);

      await client.query(`UPDATE "user" SET "role" = 'ADMIN' WHERE "id" = $1`, [
        existingUserId,
      ]);
      const { rows: administrators } = await client.query<{
        role: string;
      }>(`SELECT "role" FROM "user" WHERE "id" = $1`, [existingUserId]);
      expect(administrators).toEqual([{ role: "ADMIN" }]);
    } finally {
      await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await client.end();
    }
  }, 30_000);
});
