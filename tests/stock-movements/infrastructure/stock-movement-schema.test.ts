import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Client } from "pg";

import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "../../../src/shared/database/prisma.js";

const migrationPath = fileURLToPath(
  new URL(
    "../../../prisma/migrations/20260925162904_add_stock_movements/migration.sql",
    import.meta.url,
  ),
);
const migrationSql = readFileSync(migrationPath, "utf8");

let createdProductIds: number[] = [];
let createdCategoryIds: number[] = [];

afterEach(async () => {
  await prisma.stockMovement.deleteMany({
    where: { productId: { in: createdProductIds } },
  });
  await prisma.inventory.deleteMany({
    where: { productId: { in: createdProductIds } },
  });
  await prisma.product.deleteMany({
    where: { id: { in: createdProductIds } },
  });
  await prisma.category.deleteMany({
    where: { id: { in: createdCategoryIds } },
  });
  createdProductIds = [];
  createdCategoryIds = [];
});

async function createProduct() {
  const category = await prisma.category.create({
    data: {
      uuid: randomUUID(),
      name: `Movement category ${randomUUID()}`,
      nameNormalized: `movement-category-${randomUUID()}`,
    },
  });
  createdCategoryIds.push(category.id);

  const product = await prisma.product.create({
    data: {
      uuid: randomUUID(),
      sku: `SKU-${randomUUID()}`,
      skuNormalized: `sku-${randomUUID()}`,
      name: "Movement product",
      purchasePrice: 100,
      salePrice: 150,
      categoryId: category.id,
    },
  });
  createdProductIds.push(product.id);

  return product;
}

describe("StockMovement Prisma schema and migration", () => {
  it("creates the enum, immutable movement table, indexes, and restrictive product relation", async () => {
    const schema = `stock_movement_migration_${randomUUID().replaceAll("-", "")}`;
    const client = new Client({ connectionString: process.env.DATABASE_URL });

    try {
      await client.connect();
      await client.query(`CREATE SCHEMA "${schema}"`);
      await client.query(`SET search_path TO "${schema}"`);
      await client.query('CREATE TABLE "Product" ("id" SERIAL PRIMARY KEY)');
      await client.query(migrationSql);

      const { rows: enumValues } = await client.query<{ enumlabel: string }>(
        `SELECT enumlabel
         FROM pg_enum
         JOIN pg_type ON pg_type.oid = pg_enum.enumtypid
         JOIN pg_namespace ON pg_namespace.oid = pg_type.typnamespace
         WHERE pg_type.typname = 'StockMovementType' AND pg_namespace.nspname = $1
         ORDER BY enumsortorder`,
        [schema],
      );
      expect(enumValues).toEqual([
        { enumlabel: "IN" },
        { enumlabel: "OUT" },
        { enumlabel: "ADJUSTMENT" },
      ]);

      const { rows: columns } = await client.query<{ column_name: string }>(
        `SELECT column_name
         FROM information_schema.columns
         WHERE table_schema = $1 AND table_name = 'StockMovement'
         ORDER BY column_name`,
        [schema],
      );
      expect(columns.map(({ column_name }) => column_name)).toEqual([
        "createdAt",
        "id",
        "newStock",
        "previousStock",
        "productId",
        "quantity",
        "reason",
        "reference",
        "type",
        "uuid",
      ]);

      const { rows: indexes } = await client.query<{ indexname: string }>(
        `SELECT indexname
         FROM pg_indexes
         WHERE schemaname = $1 AND tablename = 'StockMovement'`,
        [schema],
      );
      expect(indexes.map(({ indexname }) => indexname)).toEqual(
        expect.arrayContaining([
          "StockMovement_uuid_key",
          "StockMovement_productId_createdAt_uuid_idx",
          "StockMovement_createdAt_uuid_idx",
        ]),
      );

      const { rows: foreignKeys } = await client.query<{
        confdeltype: string;
      }>(
        `SELECT confdeltype
         FROM pg_constraint
         JOIN pg_namespace ON pg_namespace.oid = pg_constraint.connamespace
         WHERE conname = 'StockMovement_productId_fkey' AND pg_namespace.nspname = $1`,
        [schema],
      );
      expect(foreignKeys).toEqual([{ confdeltype: "r" }]);
      expect(migrationSql).not.toMatch(/createdBy/i);
    } finally {
      await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await client.end();
    }
  });

  it("persists stock movements with generated UUIDs and requires an existing product", async () => {
    const product = await createProduct();
    const movement = await prisma.stockMovement.create({
      data: {
        productId: product.id,
        type: "IN",
        quantity: 5,
        previousStock: 0,
        newStock: 5,
      },
    });

    expect(movement).toMatchObject({
      productId: product.id,
      type: "IN",
      quantity: 5,
      previousStock: 0,
      newStock: 5,
      reason: null,
      reference: null,
    });
    expect(movement.uuid).toEqual(expect.any(String));
    expect(movement.createdAt).toBeInstanceOf(Date);

    await expect(
      prisma.stockMovement.create({
        data: {
          productId: 0,
          type: "OUT",
          quantity: 1,
          previousStock: 1,
          newStock: 0,
        },
      }),
    ).rejects.toMatchObject({ code: "P2003" });
  });
});
