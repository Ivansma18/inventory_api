import { randomUUID } from "node:crypto";

import { afterEach, describe, expect, it } from "vitest";

import {
  InsufficientStockError,
  StockMovementInventoryNotFoundError,
  StockMovementProductNotFoundError,
} from "../../../src/features/stock-movements/domain/stock-movement.errors.js";
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

async function createProduct(
  options: { quantity?: number; isActive?: boolean } = {},
) {
  const category = await prisma.category.create({
    data: {
      uuid: randomUUID(),
      name: `Movement repository category ${randomUUID()}`,
      nameNormalized: `movement-repository-category-${randomUUID()}`,
    },
  });
  createdCategoryIds.push(category.id);

  const product = await prisma.product.create({
    data: {
      uuid: randomUUID(),
      sku: `SKU-${randomUUID()}`,
      skuNormalized: `sku-${randomUUID()}`,
      name: "Movement repository product",
      purchasePrice: 100,
      salePrice: 150,
      isActive: options.isActive ?? true,
      categoryId: category.id,
      inventory: { create: { quantity: options.quantity ?? 0 } },
    },
  });
  createdProductIds.push(product.id);

  return product;
}

async function inventoryQuantity(productId: number): Promise<number | null> {
  const inventory = await prisma.inventory.findUnique({
    where: { productId },
    select: { quantity: true },
  });

  return inventory?.quantity ?? null;
}

describe("PrismaStockMovementRepository", () => {
  it("creates an entry and updates inventory in the same operation", async () => {
    const product = await createProduct({ quantity: 5 });

    const movement = await repository.registerAtomically({
      type: "IN",
      productUuid: product.uuid,
      quantity: 4,
      reference: "PURCHASE-001",
    });

    expect(movement).toMatchObject({
      productUuid: product.uuid,
      type: "IN",
      quantity: 4,
      previousStock: 5,
      newStock: 9,
      reason: null,
      reference: "PURCHASE-001",
    });
    expect(movement.uuid).toEqual(expect.any(String));
    expect(await inventoryQuantity(product.id)).toBe(9);
    await expect(
      prisma.stockMovement.count({ where: { productId: product.id } }),
    ).resolves.toBe(1);
  });

  it("creates an exit without allowing the inventory to become negative", async () => {
    const product = await createProduct({ quantity: 5 });

    await expect(
      repository.registerAtomically({
        type: "OUT",
        productUuid: product.uuid,
        quantity: 3,
        reference: null,
      }),
    ).resolves.toMatchObject({
      type: "OUT",
      previousStock: 5,
      newStock: 2,
      reason: null,
    });
    expect(await inventoryQuantity(product.id)).toBe(2);
  });

  it("rejects an exit that exceeds confirmed inventory without persisting changes", async () => {
    const product = await createProduct({ quantity: 2 });

    await expect(
      repository.registerAtomically({
        type: "OUT",
        productUuid: product.uuid,
        quantity: 3,
        reference: null,
      }),
    ).rejects.toThrow(InsufficientStockError);
    expect(await inventoryQuantity(product.id)).toBe(2);
    await expect(
      prisma.stockMovement.count({ where: { productId: product.id } }),
    ).resolves.toBe(0);
  });

  it("creates an adjustment using its quantity as the final inventory stock", async () => {
    const product = await createProduct({ quantity: 5 });

    await expect(
      repository.registerAtomically({
        type: "ADJUSTMENT",
        productUuid: product.uuid,
        quantity: 8,
        reason: "Inventory count",
        reference: "COUNT-001",
      }),
    ).resolves.toMatchObject({
      type: "ADJUSTMENT",
      quantity: 8,
      previousStock: 5,
      newStock: 8,
      reason: "Inventory count",
      reference: "COUNT-001",
    });
    expect(await inventoryQuantity(product.id)).toBe(8);
  });

  it("rejects an unknown product without creating a movement", async () => {
    await expect(
      repository.registerAtomically({
        type: "IN",
        productUuid: randomUUID(),
        quantity: 1,
        reference: null,
      }),
    ).rejects.toThrow(StockMovementProductNotFoundError);
    await expect(prisma.stockMovement.count()).resolves.toBe(0);
  });

  it("allows movements for inactive products", async () => {
    const product = await createProduct({ quantity: 2, isActive: false });

    await expect(
      repository.registerAtomically({
        type: "IN",
        productUuid: product.uuid,
        quantity: 1,
        reference: null,
      }),
    ).resolves.toMatchObject({ productUuid: product.uuid, newStock: 3 });
    expect(await inventoryQuantity(product.id)).toBe(3);
  });

  it("rejects a product whose inventory record is missing", async () => {
    const product = await createProduct();
    await prisma.inventory.delete({ where: { productId: product.id } });

    await expect(
      repository.registerAtomically({
        type: "IN",
        productUuid: product.uuid,
        quantity: 1,
        reference: null,
      }),
    ).rejects.toThrow(StockMovementInventoryNotFoundError);
    await expect(
      prisma.stockMovement.count({ where: { productId: product.id } }),
    ).resolves.toBe(0);
  });

  it("rolls back the inventory update when movement persistence fails", async () => {
    const product = await createProduct({ quantity: 5 });
    const triggerName = `stock_movement_failure_${randomUUID().replaceAll("-", "")}`;
    const functionName = `${triggerName}_function`;

    try {
      await prisma.$executeRawUnsafe(`
        CREATE FUNCTION "${functionName}"() RETURNS trigger AS $$
        BEGIN
          RAISE EXCEPTION 'Stock movement creation failed';
        END;
        $$ LANGUAGE plpgsql;
      `);
      await prisma.$executeRawUnsafe(`
        CREATE TRIGGER "${triggerName}"
        BEFORE INSERT ON "StockMovement"
        FOR EACH ROW EXECUTE FUNCTION "${functionName}"();
      `);

      await expect(
        repository.registerAtomically({
          type: "IN",
          productUuid: product.uuid,
          quantity: 4,
          reference: null,
        }),
      ).rejects.toThrow("Stock movement creation failed");
      expect(await inventoryQuantity(product.id)).toBe(5);
      await expect(
        prisma.stockMovement.count({ where: { productId: product.id } }),
      ).resolves.toBe(0);
    } finally {
      await prisma.$executeRawUnsafe(
        `DROP TRIGGER IF EXISTS "${triggerName}" ON "StockMovement"`,
      );
      await prisma.$executeRawUnsafe(
        `DROP FUNCTION IF EXISTS "${functionName}"()`,
      );
    }
  });
});
