import { randomUUID } from "node:crypto";

import { afterEach, describe, expect, it } from "vitest";

import {
  createProduct,
  updateProduct,
  type Product,
} from "../../../src/features/products/domain/product.entity.js";
import {
  productListTieBreakers,
  productSortFields,
  type ProductSortField,
} from "../../../src/features/products/domain/product.repository.js";
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

  it("filters case-insensitively, combines search and state, and counts before pagination", async () => {
    const activeFrame = createTestProduct({
      sku: "FRAME-ACTIVE",
      name: "Frame desk",
    });
    const inactiveFrame = createTestProduct({
      sku: "FRAME-INACTIVE",
      name: "Archived frame",
      isActive: false,
    });
    const activeChair = createTestProduct({
      sku: "CHAIR-ACTIVE",
      name: "Office chair",
    });
    createdProductUuids.push(
      activeFrame.uuid,
      inactiveFrame.uuid,
      activeChair.uuid,
    );

    await Promise.all([
      repository.create(activeFrame),
      repository.create(inactiveFrame),
      repository.create(activeChair),
    ]);

    await expect(
      repository.findMany({
        page: 1,
        limit: 1,
        search: "fRaMe",
        isActive: true,
        sort: "name",
        order: "asc",
        tieBreakers: productListTieBreakers,
      }),
    ).resolves.toEqual({ products: [activeFrame], total: 1 });

    await expect(
      repository.findMany({
        page: 1,
        limit: 15,
        search: "frame",
        isActive: false,
        sort: "name",
        order: "asc",
        tieBreakers: productListTieBreakers,
      }),
    ).resolves.toEqual({ products: [inactiveFrame], total: 1 });
  });

  it("paginates ordered matches and reports their unpaginated total", async () => {
    const products = [
      createTestProduct({ name: "Alpha" }),
      createTestProduct({ name: "Bravo" }),
      createTestProduct({ name: "Charlie" }),
    ];
    createdProductUuids.push(...products.map((product) => product.uuid));
    await Promise.all(products.map((product) => repository.create(product)));

    await expect(
      repository.findMany({
        page: 2,
        limit: 1,
        isActive: true,
        sort: "name",
        order: "asc",
        tieBreakers: productListTieBreakers,
      }),
    ).resolves.toEqual({ products: [products[1]], total: 3 });
  });

  it("orders every supported field in both directions", async () => {
    const products = [
      createTestProduct({
        uuid: "00000000-0000-4000-8000-000000000001",
        sku: "SKU-B",
        name: "Bravo",
        purchasePrice: 20,
        salePrice: 300,
        createdAt: new Date("2026-09-23T12:00:00.000Z"),
        updatedAt: new Date("2026-09-23T14:00:00.000Z"),
      }),
      createTestProduct({
        uuid: "00000000-0000-4000-8000-000000000002",
        sku: "SKU-A",
        name: "Alpha",
        purchasePrice: 10,
        salePrice: 100,
        createdAt: new Date("2026-09-23T11:00:00.000Z"),
        updatedAt: new Date("2026-09-23T13:00:00.000Z"),
      }),
      createTestProduct({
        uuid: "00000000-0000-4000-8000-000000000003",
        sku: "SKU-C",
        name: "Charlie",
        purchasePrice: 30,
        salePrice: 200,
        createdAt: new Date("2026-09-23T13:00:00.000Z"),
        updatedAt: new Date("2026-09-23T12:00:00.000Z"),
      }),
    ];
    createdProductUuids.push(...products.map((product) => product.uuid));
    await Promise.all(products.map((product) => repository.create(product)));

    const expectedAscending: Record<ProductSortField, readonly Product[]> = {
      name: [products[1], products[0], products[2]],
      sku: [products[1], products[0], products[2]],
      purchasePrice: [products[1], products[0], products[2]],
      salePrice: [products[1], products[2], products[0]],
      createdAt: [products[1], products[0], products[2]],
      updatedAt: [products[2], products[1], products[0]],
    } as const;

    for (const sort of productSortFields) {
      const expected = expectedAscending[sort];

      await expect(
        repository.findMany({
          page: 1,
          limit: 15,
          isActive: true,
          sort,
          order: "asc",
          tieBreakers: productListTieBreakers,
        }),
      ).resolves.toEqual({ products: expected, total: 3 });

      await expect(
        repository.findMany({
          page: 1,
          limit: 15,
          isActive: true,
          sort,
          order: "desc",
          tieBreakers: productListTieBreakers,
        }),
      ).resolves.toEqual({ products: [...expected].reverse(), total: 3 });
    }
  });

  it("uses createdAt and UUID as stable ascending tie breakers", async () => {
    const products = [
      createTestProduct({
        uuid: "00000000-0000-4000-8000-000000000003",
        name: "Tied",
        createdAt: new Date("2026-09-23T12:00:00.000Z"),
      }),
      createTestProduct({
        uuid: "00000000-0000-4000-8000-000000000002",
        name: "Tied",
        createdAt: new Date("2026-09-23T11:00:00.000Z"),
      }),
      createTestProduct({
        uuid: "00000000-0000-4000-8000-000000000001",
        name: "Tied",
        createdAt: new Date("2026-09-23T11:00:00.000Z"),
      }),
    ];
    createdProductUuids.push(...products.map((product) => product.uuid));
    await Promise.all(products.map((product) => repository.create(product)));

    await expect(
      repository.findMany({
        page: 1,
        limit: 15,
        isActive: true,
        sort: "name",
        order: "asc",
        tieBreakers: productListTieBreakers,
      }),
    ).resolves.toEqual({
      products: [products[2], products[1], products[0]],
      total: 3,
    });
  });
});
