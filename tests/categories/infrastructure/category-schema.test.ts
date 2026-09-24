import { randomUUID } from "node:crypto";

import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "../../../src/shared/database/prisma.js";

let createdCategoryUuids: string[] = [];

afterEach(async () => {
  await prisma.product.deleteMany({
    where: { category: { uuid: { in: createdCategoryUuids } } },
  });
  await prisma.category.deleteMany({
    where: { uuid: { in: createdCategoryUuids } },
  });
  createdCategoryUuids = [];
});

async function createCategory(
  overrides: Partial<{ uuid: string; name: string }> = {},
) {
  const uuid = overrides.uuid ?? randomUUID();
  createdCategoryUuids.push(uuid);

  return prisma.category.create({
    data: {
      uuid,
      name: overrides.name ?? "Office furniture",
      nameNormalized: (overrides.name ?? "Office furniture").toLowerCase(),
    },
  });
}

describe("Category Prisma schema", () => {
  it("persists category UUIDs and enforces unique normalized names", async () => {
    const category = await createCategory();

    expect(category).toMatchObject({
      uuid: expect.any(String),
      name: "Office furniture",
      nameNormalized: "office furniture",
      description: null,
      isActive: true,
    });

    await expect(
      createCategory({ name: "OFFICE FURNITURE" }),
    ).rejects.toMatchObject({
      code: "P2002",
    });
  });

  it("requires a category after the final migration", async () => {
    await expect(
      prisma.$executeRaw`
        INSERT INTO "Product" (
          "uuid", "sku", "skuNormalized", "name", "purchasePrice", "salePrice"
        ) VALUES (
          ${randomUUID()}::uuid,
          ${`SKU-${randomUUID()}`},
          ${`sku-${randomUUID()}`},
          'Unclassified desk',
          100,
          150
        )
      `,
    ).rejects.toThrow();
  });

  it("aborts the migration check without changing a nullable column", async () => {
    const tableName = `ProductCategoryMigration${randomUUID().replaceAll("-", "")}`;

    await prisma.$executeRawUnsafe(
      `CREATE TABLE "${tableName}" ("categoryId" INTEGER)`,
    );

    try {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "${tableName}" ("categoryId") VALUES (NULL)`,
      );

      await expect(
        prisma.$transaction(async (transaction) => {
          const [{ count }] = await transaction.$queryRawUnsafe<
            { count: bigint }[]
          >(
            `SELECT COUNT(*)::bigint AS count FROM "${tableName}" WHERE "categoryId" IS NULL`,
          );

          if (count > 0n) {
            throw new Error("Unclassified products exist.");
          }

          await transaction.$executeRawUnsafe(
            `ALTER TABLE "${tableName}" ALTER COLUMN "categoryId" SET NOT NULL`,
          );
        }),
      ).rejects.toThrow("Unclassified products exist.");

      const [{ is_nullable: isNullable }] = await prisma.$queryRawUnsafe<
        { is_nullable: string }[]
      >(
        `SELECT is_nullable FROM information_schema.columns WHERE table_name = '${tableName}' AND column_name = 'categoryId'`,
      );

      expect(isNullable).toBe("YES");

      await prisma.$executeRawUnsafe(`DELETE FROM "${tableName}"`);
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "${tableName}" ALTER COLUMN "categoryId" SET NOT NULL`,
      );

      const [{ is_nullable: hardenedIsNullable }] =
        await prisma.$queryRawUnsafe<{ is_nullable: string }[]>(
          `SELECT is_nullable FROM information_schema.columns WHERE table_name = '${tableName}' AND column_name = 'categoryId'`,
        );

      expect(hardenedIsNullable).toBe("NO");
    } finally {
      await prisma.$executeRawUnsafe(`DROP TABLE "${tableName}"`);
    }
  });

  it("prevents deleting a category with associated products", async () => {
    const category = await createCategory();
    const product = await prisma.product.create({
      data: {
        uuid: randomUUID(),
        sku: `SKU-${randomUUID()}`,
        skuNormalized: `sku-${randomUUID()}`,
        name: "Categorized desk",
        purchasePrice: 100,
        salePrice: 150,
        categoryId: category.id,
      },
    });

    try {
      await expect(
        prisma.category.delete({ where: { id: category.id } }),
      ).rejects.toMatchObject({
        code: "P2003",
      });
    } finally {
      await prisma.product.delete({ where: { id: product.id } });
    }
  });
});
