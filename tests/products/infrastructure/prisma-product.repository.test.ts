import { randomUUID } from "node:crypto";

import { afterEach, describe, expect, it } from "vitest";

import {
  createProduct,
  updateProduct,
  type Product,
} from "../../../src/features/products/domain/product.entity.js";
import { PrismaProductRepository } from "../../../src/features/products/infrastructure/prisma-product.repository.js";
import { prisma } from "../../../src/shared/database/prisma.js";

const repository = new PrismaProductRepository(prisma);
let createdProductUuids: string[] = [];

afterEach(async () => {
  await prisma.product.deleteMany({
    where: { uuid: { in: createdProductUuids } },
  });
  createdProductUuids = [];
});

function createTestProduct(overrides: Partial<Product> = {}): Product {
  const timestamp = new Date("2026-09-23T10:00:00.000Z");
  const uuid = overrides.uuid ?? randomUUID();
  const sku = overrides.sku ?? `SKU-${uuid}`;

  return {
    ...createProduct({
      uuid,
      sku,
      name: "Integration desk",
      description: "Created by an integration test",
      purchasePrice: 100.25,
      salePrice: 150.5,
      createdAt: timestamp,
      updatedAt: timestamp,
    }),
    ...overrides,
  };
}

describe("PrismaProductRepository", () => {
  it("creates and finds products while preserving the domain representation", async () => {
    const product = createTestProduct();
    createdProductUuids.push(product.uuid);

    await expect(repository.create(product)).resolves.toEqual(product);
    await expect(repository.findByUuid(product.uuid)).resolves.toEqual(product);
    await expect(
      repository.findBySkuNormalized(product.skuNormalized),
    ).resolves.toEqual(product);
    await expect(repository.findByUuid(randomUUID())).resolves.toBeNull();
  });

  it("enforces unique normalized SKUs in PostgreSQL", async () => {
    const product = createTestProduct();
    const duplicate = createTestProduct({
      sku: product.sku.toLowerCase(),
      skuNormalized: product.skuNormalized,
    });
    createdProductUuids.push(product.uuid, duplicate.uuid);

    await repository.create(product);

    await expect(repository.create(duplicate)).rejects.toMatchObject({
      code: "P2002",
    });
  });

  it("updates persisted products without losing nullable fields or state", async () => {
    const product = createTestProduct();
    createdProductUuids.push(product.uuid);
    await repository.create(product);

    const updatedProduct = updateProduct(
      product,
      {
        name: "Updated integration desk",
        description: null,
        purchasePrice: 99.99,
        isActive: false,
      },
      new Date("2026-09-23T11:00:00.000Z"),
    );

    await expect(repository.update(updatedProduct)).resolves.toEqual(
      updatedProduct,
    );
    await expect(repository.findByUuid(product.uuid)).resolves.toEqual(
      updatedProduct,
    );
  });
});
