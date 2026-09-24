import { randomUUID } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  createCategory,
  type Category,
} from "../../../src/features/categories/domain/category.entity.js";
import { PrismaCategoryRepository } from "../../../src/features/categories/infrastructure/prisma-category.repository.js";
import {
  createProduct,
  type Product,
} from "../../../src/features/products/domain/product.entity.js";
import { PrismaProductRepository } from "../../../src/features/products/infrastructure/prisma-product.repository.js";
import { PrismaInventoryRepository } from "../../../src/features/inventory/infrastructure/prisma-inventory.repository.js";
import { prisma } from "../../../src/shared/database/prisma.js";

const inventoryRepository = new PrismaInventoryRepository(prisma);
const productRepository = new PrismaProductRepository(prisma);
const categoryRepository = new PrismaCategoryRepository(prisma);
let createdProductUuids: string[] = [];
let createdCategoryUuids: string[] = [];
let defaultCategoryUuid: string;

beforeEach(async () => {
  const category = createTestCategory();
  defaultCategoryUuid = category.uuid;
  createdCategoryUuids.push(category.uuid);
  await categoryRepository.create(category);
});

afterEach(async () => {
  await prisma.inventory.deleteMany({
    where: { product: { uuid: { in: createdProductUuids } } },
  });
  await prisma.product.deleteMany({
    where: { uuid: { in: createdProductUuids } },
  });
  await prisma.category.deleteMany({
    where: { uuid: { in: createdCategoryUuids } },
  });
  createdProductUuids = [];
  createdCategoryUuids = [];
});

function createTestCategory(overrides: Partial<Category> = {}): Category {
  const timestamp = new Date("2026-09-24T10:00:00.000Z");
  const uuid = overrides.uuid ?? randomUUID();

  return {
    ...createCategory({
      uuid,
      name: `Category ${uuid}`,
      description: "Created by an inventory repository integration test",
      createdAt: timestamp,
      updatedAt: timestamp,
    }),
    ...overrides,
  };
}

function createTestProduct(overrides: Partial<Product> = {}): Product {
  const timestamp = new Date("2026-09-24T10:00:00.000Z");
  const uuid = overrides.uuid ?? randomUUID();
  const sku = overrides.sku ?? `SKU-${uuid}`;

  return {
    ...createProduct({
      uuid,
      sku,
      name: "Integration desk",
      description: "Created by an inventory repository integration test",
      purchasePrice: 100,
      salePrice: 150,
      categoryUuid: defaultCategoryUuid,
      createdAt: timestamp,
      updatedAt: timestamp,
    }),
    ...overrides,
  };
}

async function createListedInventory(
  overrides: Partial<{
    sku: string;
    name: string;
    isActive: boolean;
    quantity: number;
    minimumStock: number;
    updatedAt: Date;
  }>,
) {
  const product = createTestProduct({
    sku: overrides.sku,
    skuNormalized: overrides.sku?.toLowerCase(),
    name: overrides.name,
    isActive: overrides.isActive,
  });
  createdProductUuids.push(product.uuid);
  await productRepository.create(product);
  const inventory = await inventoryRepository.findByProductUuid(product.uuid);

  if (!inventory) {
    throw new Error("Expected an inventory for the created product.");
  }

  await prisma.inventory.update({
    where: { uuid: inventory.uuid },
    data: {
      quantity: overrides.quantity ?? inventory.quantity,
      minimumStock: overrides.minimumStock ?? inventory.minimumStock,
      updatedAt: overrides.updatedAt ?? inventory.updatedAt,
    },
  });

  const updatedInventory = await inventoryRepository.findByProductUuid(
    product.uuid,
  );

  if (!updatedInventory) {
    throw new Error("Expected an updated inventory for the created product.");
  }

  return updatedInventory;
}

describe("PrismaInventoryRepository", () => {
  it("returns an inventory with its product summary", async () => {
    const product = createTestProduct();
    createdProductUuids.push(product.uuid);
    await productRepository.create(product);

    const inventory = await inventoryRepository.findByProductUuid(product.uuid);

    expect(inventory).toMatchObject({
      productUuid: product.uuid,
      sku: product.sku,
      name: product.name,
      categoryUuid: product.categoryUuid,
      isActive: true,
      quantity: 0,
      minimumStock: 0,
    });
    expect(inventory?.uuid).toEqual(expect.any(String));
    expect(inventory?.updatedAt).toBeInstanceOf(Date);
    await expect(
      inventoryRepository.findByProductUuid(randomUUID()),
    ).resolves.toBeNull();
  });

  it("updates only minimum stock and supports inactive products", async () => {
    const product = createTestProduct({ isActive: false });
    const timestamp = new Date("2026-09-24T11:00:00.000Z");
    createdProductUuids.push(product.uuid);
    await productRepository.create(product);
    const storedInventory = await inventoryRepository.findByProductUuid(
      product.uuid,
    );

    if (!storedInventory) {
      throw new Error("Expected an inventory for the created product.");
    }

    await expect(
      inventoryRepository.updateMinimumStock({
        ...storedInventory,
        minimumStock: 3,
        updatedAt: timestamp,
      }),
    ).resolves.toEqual({
      ...storedInventory,
      minimumStock: 3,
      updatedAt: timestamp,
    });
  });

  it("filters calculated statuses and counts matching inventories before pagination", async () => {
    const marker = randomUUID();
    const lowStock = await createListedInventory({
      sku: `${marker}-LOW`,
      name: `${marker} Low stock`,
      quantity: 2,
      minimumStock: 2,
    });
    await createListedInventory({
      sku: `${marker}-IN`,
      name: `${marker} In stock`,
      quantity: 3,
      minimumStock: 2,
    });
    await createListedInventory({
      sku: `${marker}-OUT`,
      name: `${marker} Out of stock`,
      isActive: false,
      quantity: 0,
      minimumStock: 2,
    });

    await expect(
      inventoryRepository.findMany({
        page: 1,
        limit: 1,
        search: marker,
        isActive: true,
        status: "LOW_STOCK",
        sort: "name",
        order: "asc",
        tieBreakers: [
          { sort: "sku", order: "asc" },
          { sort: "productUuid", order: "asc" },
        ],
      }),
    ).resolves.toEqual({ inventories: [lowStock], total: 1 });

    await expect(
      inventoryRepository.findMany({
        page: 1,
        limit: 15,
        search: marker,
        status: "OUT_OF_STOCK",
        sort: "name",
        order: "asc",
        tieBreakers: [
          { sort: "sku", order: "asc" },
          { sort: "productUuid", order: "asc" },
        ],
      }),
    ).resolves.toMatchObject({ total: 1, inventories: [{ quantity: 0 }] });

    await expect(
      inventoryRepository.findMany({
        page: 1,
        limit: 15,
        search: marker,
        isActive: false,
        sort: "name",
        order: "asc",
        tieBreakers: [
          { sort: "sku", order: "asc" },
          { sort: "productUuid", order: "asc" },
        ],
      }),
    ).resolves.toMatchObject({ total: 1, inventories: [{ quantity: 0 }] });

    await expect(
      inventoryRepository.findMany({
        page: 1,
        limit: 15,
        search: marker,
        status: "IN_STOCK",
        sort: "name",
        order: "asc",
        tieBreakers: [
          { sort: "sku", order: "asc" },
          { sort: "productUuid", order: "asc" },
        ],
      }),
    ).resolves.toMatchObject({ total: 1, inventories: [{ quantity: 3 }] });
  });

  it("orders every field with stable SKU and product UUID tie breakers", async () => {
    const marker = randomUUID();
    const inventories = [
      await createListedInventory({
        sku: `${marker}-A`,
        name: `${marker} Alpha`,
        quantity: 2,
        minimumStock: 2,
        updatedAt: new Date("2026-09-24T12:00:00.000Z"),
      }),
      await createListedInventory({
        sku: `${marker}-B`,
        name: `${marker} Bravo`,
        quantity: 4,
        minimumStock: 1,
        updatedAt: new Date("2026-09-24T13:00:00.000Z"),
      }),
      await createListedInventory({
        sku: `${marker}-C`,
        name: `${marker} Charlie`,
        quantity: 0,
        minimumStock: 3,
        updatedAt: new Date("2026-09-24T11:00:00.000Z"),
      }),
      await createListedInventory({
        sku: `${marker}-D`,
        name: `${marker} Delta`,
        quantity: 1,
        minimumStock: 3,
        updatedAt: new Date("2026-09-24T14:00:00.000Z"),
      }),
      await createListedInventory({
        sku: `${marker}-E`,
        name: `${marker} Alpha`,
        quantity: 3,
        minimumStock: 4,
        updatedAt: new Date("2026-09-24T15:00:00.000Z"),
      }),
    ];
    const [alpha, bravo, charlie, delta, alphaTie] = inventories;
    const expectedAscending = {
      name: [alpha, alphaTie, bravo, charlie, delta],
      sku: [alpha, bravo, charlie, delta, alphaTie],
      quantity: [charlie, delta, alpha, alphaTie, bravo],
      minimumStock: [bravo, alpha, charlie, delta, alphaTie],
      updatedAt: [charlie, alpha, bravo, delta, alphaTie],
    } as const;
    const expectedDescending = {
      name: [delta, charlie, bravo, alpha, alphaTie],
      sku: [alphaTie, delta, charlie, bravo, alpha],
      quantity: [bravo, alphaTie, alpha, delta, charlie],
      minimumStock: [alphaTie, charlie, delta, alpha, bravo],
      updatedAt: [alphaTie, delta, bravo, alpha, charlie],
    } as const;

    for (const [sort, expected] of Object.entries(expectedAscending)) {
      const query = {
        page: 2,
        limit: 2,
        search: marker,
        sort: sort as keyof typeof expectedAscending,
        tieBreakers: [
          { sort: "sku" as const, order: "asc" as const },
          { sort: "productUuid" as const, order: "asc" as const },
        ],
      };

      await expect(
        inventoryRepository.findMany({ ...query, order: "asc" }),
      ).resolves.toEqual({ inventories: expected.slice(2, 4), total: 5 });
      await expect(
        inventoryRepository.findMany({
          ...query,
          page: 1,
          limit: 15,
          order: "desc",
        }),
      ).resolves.toEqual({
        inventories:
          expectedDescending[sort as keyof typeof expectedDescending],
        total: 5,
      });
    }
  });
});
