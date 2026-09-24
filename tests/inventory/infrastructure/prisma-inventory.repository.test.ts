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

  return {
    ...createProduct({
      uuid,
      sku: `SKU-${uuid}`,
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
});
