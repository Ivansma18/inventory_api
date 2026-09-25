import { randomUUID } from "node:crypto";

import { afterEach, describe, expect, it } from "vitest";

import type { StockMovementListQuery } from "../../../src/features/stock-movements/domain/stock-movement.repository.js";
import { PrismaStockMovementRepository } from "../../../src/features/stock-movements/infrastructure/prisma-stock-movement.repository.js";
import { prisma } from "../../../src/shared/database/prisma.js";

const repository = new PrismaStockMovementRepository(prisma);
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
      name: `Movement list category ${randomUUID()}`,
      nameNormalized: `movement-list-category-${randomUUID()}`,
    },
  });
  createdCategoryIds.push(category.id);

  const product = await prisma.product.create({
    data: {
      uuid: randomUUID(),
      sku: `SKU-${randomUUID()}`,
      skuNormalized: `sku-${randomUUID()}`,
      name: "Movement list product",
      purchasePrice: 100,
      salePrice: 150,
      categoryId: category.id,
      inventory: { create: {} },
    },
  });
  createdProductIds.push(product.id);

  return product;
}

async function createMovement(data: {
  uuid: string;
  productId: number;
  type: "IN" | "OUT" | "ADJUSTMENT";
  reference: string | null;
  createdAt: Date;
}) {
  return prisma.stockMovement.create({
    data: {
      ...data,
      quantity: 1,
      previousStock: 0,
      newStock: 1,
      reason: data.type === "ADJUSTMENT" ? "Inventory count" : null,
    },
  });
}

function listQuery(
  overrides: Partial<StockMovementListQuery> = {},
): StockMovementListQuery {
  return {
    page: 1,
    limit: 15,
    sort: "createdAt",
    order: "desc",
    tieBreakers: [{ sort: "uuid", order: "asc" }],
    ...overrides,
  };
}

describe("PrismaStockMovementRepository.findMany", () => {
  it("filters globally by type, product and a case-insensitive non-null reference", async () => {
    const firstProduct = await createProduct();
    const secondProduct = await createProduct();
    const date = new Date("2026-01-02T10:00:00.000Z");

    const first = await createMovement({
      uuid: "00000000-0000-4000-8000-000000000001",
      productId: firstProduct.id,
      type: "IN",
      reference: "Purchase-A",
      createdAt: date,
    });
    await createMovement({
      uuid: "00000000-0000-4000-8000-000000000002",
      productId: firstProduct.id,
      type: "OUT",
      reference: null,
      createdAt: date,
    });
    const second = await createMovement({
      uuid: "00000000-0000-4000-8000-000000000003",
      productId: firstProduct.id,
      type: "ADJUSTMENT",
      reference: "purchase-b",
      createdAt: date,
    });
    await createMovement({
      uuid: "00000000-0000-4000-8000-000000000004",
      productId: secondProduct.id,
      type: "IN",
      reference: "Purchase-C",
      createdAt: date,
    });

    await expect(
      repository.findMany(listQuery({ type: "IN" })),
    ).resolves.toMatchObject({
      total: 2,
      movements: expect.arrayContaining([
        expect.objectContaining({ uuid: first.uuid }),
      ]),
    });
    await expect(
      repository.findMany(listQuery({ productUuid: firstProduct.uuid })),
    ).resolves.toMatchObject({ total: 3 });
    await expect(
      repository.findMany(listQuery({ reference: "PURCHASE" })),
    ).resolves.toMatchObject({
      total: 3,
      movements: expect.arrayContaining([
        expect.objectContaining({ uuid: first.uuid }),
        expect.objectContaining({ uuid: second.uuid }),
      ]),
    });
  });

  it("filters inclusive date ranges with open endpoints", async () => {
    const product = await createProduct();
    const first = await createMovement({
      uuid: "00000000-0000-4000-8000-000000000011",
      productId: product.id,
      type: "IN",
      reference: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });
    const second = await createMovement({
      uuid: "00000000-0000-4000-8000-000000000012",
      productId: product.id,
      type: "OUT",
      reference: null,
      createdAt: new Date("2026-01-02T00:00:00.000Z"),
    });
    const third = await createMovement({
      uuid: "00000000-0000-4000-8000-000000000013",
      productId: product.id,
      type: "ADJUSTMENT",
      reference: null,
      createdAt: new Date("2026-01-03T00:00:00.000Z"),
    });

    await expect(
      repository.findMany(
        listQuery({
          from: second.createdAt,
          to: second.createdAt,
        }),
      ),
    ).resolves.toMatchObject({ total: 1, movements: [{ uuid: second.uuid }] });
    await expect(
      repository.findMany(listQuery({ from: second.createdAt })),
    ).resolves.toMatchObject({
      total: 2,
      movements: expect.arrayContaining([
        expect.objectContaining({ uuid: second.uuid }),
        expect.objectContaining({ uuid: third.uuid }),
      ]),
    });
    await expect(
      repository.findMany(listQuery({ to: second.createdAt })),
    ).resolves.toMatchObject({
      total: 2,
      movements: expect.arrayContaining([
        expect.objectContaining({ uuid: first.uuid }),
        expect.objectContaining({ uuid: second.uuid }),
      ]),
    });
  });

  it("counts filtered movements before pagination and orders equal dates by UUID", async () => {
    const product = await createProduct();
    const date = new Date("2026-01-02T10:00:00.000Z");
    const uuids = [
      "00000000-0000-4000-8000-000000000023",
      "00000000-0000-4000-8000-000000000021",
      "00000000-0000-4000-8000-000000000022",
    ];

    for (const uuid of uuids) {
      await createMovement({
        uuid,
        productId: product.id,
        type: "IN",
        reference: "BATCH",
        createdAt: date,
      });
    }
    await createMovement({
      uuid: "00000000-0000-4000-8000-000000000024",
      productId: product.id,
      type: "OUT",
      reference: "OTHER",
      createdAt: new Date("2026-01-03T10:00:00.000Z"),
    });

    await expect(
      repository.findMany(listQuery({ type: "IN", page: 2, limit: 2 })),
    ).resolves.toMatchObject({
      total: 3,
      movements: [{ uuid: "00000000-0000-4000-8000-000000000023" }],
    });
    await expect(
      repository.findMany(listQuery({ type: "IN", page: 1, limit: 2 })),
    ).resolves.toMatchObject({
      total: 3,
      movements: [
        { uuid: "00000000-0000-4000-8000-000000000021" },
        { uuid: "00000000-0000-4000-8000-000000000022" },
      ],
    });
  });
});
