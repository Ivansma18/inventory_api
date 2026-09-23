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

  it("allows products without a category during the temporary migration", async () => {
    const product = await prisma.product.create({
      data: {
        uuid: randomUUID(),
        sku: `SKU-${randomUUID()}`,
        skuNormalized: `sku-${randomUUID()}`,
        name: "Unclassified desk",
        purchasePrice: 100,
        salePrice: 150,
      },
    });

    try {
      expect(product.categoryId).toBeNull();
    } finally {
      await prisma.product.delete({ where: { id: product.id } });
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
