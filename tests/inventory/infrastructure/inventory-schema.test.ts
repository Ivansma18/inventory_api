import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Client } from "pg";

import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "../../../src/shared/database/prisma.js";

const migrationPath = fileURLToPath(
  new URL(
    "../../../prisma/migrations/20260924174932_add_inventory/migration.sql",
    import.meta.url,
  ),
);
const migrationSql = readFileSync(migrationPath, "utf8");
const backfillStatement = migrationSql.match(
  /INSERT INTO "Inventory"[\s\S]*?ON CONFLICT \("productId"\) DO NOTHING;/,
)?.[0];

let createdInventoryIds: number[] = [];
let createdProductIds: number[] = [];
let createdCategoryIds: number[] = [];

afterEach(async () => {
  await prisma.inventory.deleteMany({
    where: { id: { in: createdInventoryIds } },
  });
  await prisma.product.deleteMany({
    where: { id: { in: createdProductIds } },
  });
  await prisma.category.deleteMany({
    where: { id: { in: createdCategoryIds } },
  });
  createdInventoryIds = [];
  createdProductIds = [];
  createdCategoryIds = [];
});

async function createProduct() {
  const category = await prisma.category.create({
    data: {
      uuid: randomUUID(),
      name: `Inventory category ${randomUUID()}`,
      nameNormalized: `inventory-category-${randomUUID()}`,
    },
  });
  createdCategoryIds.push(category.id);

  const product = await prisma.product.create({
    data: {
      uuid: randomUUID(),
      sku: `SKU-${randomUUID()}`,
      skuNormalized: `sku-${randomUUID()}`,
      name: "Inventory product",
      purchasePrice: 100,
      salePrice: 150,
      categoryId: category.id,
    },
  });
  createdProductIds.push(product.id);

  return product;
}

describe("Inventory Prisma schema and migration", () => {
  it("backfills existing products exactly once using the migration statements", async () => {
    const schema = `inventory_migration_${randomUUID().replaceAll("-", "")}`;
    const client = new Client({ connectionString: process.env.DATABASE_URL });

    try {
      await client.connect();
      await client.query(`CREATE SCHEMA "${schema}"`);
      await client.query(`SET search_path TO "${schema}"`);
      await client.query('CREATE TABLE "Product" ("id" SERIAL PRIMARY KEY)');
      await client.query(
        'INSERT INTO "Product" ("id") VALUES (DEFAULT), (DEFAULT)',
      );
      await client.query(migrationSql);

      const { rows: createdInventories } = await client.query<{
        productId: number;
        quantity: number;
        minimumStock: number;
      }>(
        'SELECT "productId", "quantity", "minimumStock" FROM "Inventory" ORDER BY "productId"',
      );
      expect(createdInventories).toEqual([
        { productId: 1, quantity: 0, minimumStock: 0 },
        { productId: 2, quantity: 0, minimumStock: 0 },
      ]);

      if (!backfillStatement) {
        throw new Error("Inventory backfill statement was not found.");
      }

      await client.query(backfillStatement);
      const { rows: counts } = await client.query<{ count: string }>(
        'SELECT COUNT(*) AS count FROM "Inventory"',
      );
      expect(counts[0]?.count).toBe("2");
    } finally {
      await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await client.end();
    }
  });

  it("enforces defaults, one inventory per product, and non-negative values", async () => {
    const product = await createProduct();
    const inventory = await prisma.inventory.create({
      data: { productId: product.id },
    });
    createdInventoryIds.push(inventory.id);

    expect(inventory).toMatchObject({
      productId: product.id,
      quantity: 0,
      minimumStock: 0,
    });
    expect(inventory.uuid).toEqual(expect.any(String));

    const columnTypes = await prisma.$queryRaw<
      { column_name: string; data_type: string }[]
    >`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'Inventory'
        AND column_name IN ('quantity', 'minimumStock')
      ORDER BY column_name
    `;
    expect(columnTypes).toEqual([
      { column_name: "minimumStock", data_type: "integer" },
      { column_name: "quantity", data_type: "integer" },
    ]);

    await expect(
      prisma.inventory.create({ data: { productId: product.id } }),
    ).rejects.toMatchObject({ code: "P2002" });
    await expect(
      prisma.$executeRaw`
        UPDATE "Inventory" SET "quantity" = ${-1} WHERE "id" = ${inventory.id}
      `,
    ).rejects.toThrow();
    await expect(
      prisma.$executeRaw`
        UPDATE "Inventory" SET "minimumStock" = ${-1} WHERE "id" = ${inventory.id}
      `,
    ).rejects.toThrow();
  });
});
