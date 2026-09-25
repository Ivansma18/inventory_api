import { randomUUID } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  createProduct,
  updateProduct,
  type Product,
} from "../../../src/features/products/domain/product.entity.js";
import { ProductCategoryAssignmentConflictError } from "../../../src/features/products/domain/product.errors.js";
import {
  productListTieBreakers,
  productSortFields,
  type ProductSortField,
} from "../../../src/features/products/domain/product.repository.js";
import { PrismaProductRepository } from "../../../src/features/products/infrastructure/prisma-product.repository.js";
import {
  createCategory,
  updateCategory,
  type Category,
} from "../../../src/features/categories/domain/category.entity.js";
import { PrismaCategoryRepository } from "../../../src/features/categories/infrastructure/prisma-category.repository.js";
import { prisma } from "../../../src/shared/database/prisma.js";

const repository = new PrismaProductRepository(prisma);
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
      categoryUuid: overrides.categoryUuid ?? defaultCategoryUuid,
      createdAt: timestamp,
      updatedAt: timestamp,
    }),
    ...overrides,
  };
}

function createTestCategory(overrides: Partial<Category> = {}): Category {
  const timestamp = new Date("2026-09-23T10:00:00.000Z");
  const uuid = overrides.uuid ?? randomUUID();
  const name = overrides.name ?? `Category ${uuid}`;

  return {
    ...createCategory({
      uuid,
      name,
      description: "Created by a product integration test",
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

  it("creates one initial inventory record with zero values", async () => {
    const product = createTestProduct();
    createdProductUuids.push(product.uuid);

    await repository.create(product);

    await expect(
      prisma.inventory.findFirst({
        where: { product: { uuid: product.uuid } },
        select: { quantity: true, minimumStock: true },
      }),
    ).resolves.toEqual({ quantity: 0, minimumStock: 0 });
  });

  it("rolls back product creation when its initial inventory cannot be created", async () => {
    const triggerName = `inventory_creation_failure_${randomUUID().replaceAll("-", "")}`;
    const functionName = `${triggerName}_function`;
    const product = createTestProduct();
    createdProductUuids.push(product.uuid);

    try {
      await prisma.$executeRawUnsafe(`
        CREATE FUNCTION "${functionName}"() RETURNS trigger AS $$
        BEGIN
          RAISE EXCEPTION 'Inventory creation failed';
        END;
        $$ LANGUAGE plpgsql;
      `);
      await prisma.$executeRawUnsafe(`
        CREATE TRIGGER "${triggerName}"
        BEFORE INSERT ON "Inventory"
        FOR EACH ROW EXECUTE FUNCTION "${functionName}"();
      `);

      await expect(repository.create(product)).rejects.toThrow(
        "Inventory creation failed",
      );
      await expect(
        prisma.product.findUnique({
          where: { uuid: product.uuid },
        }),
      ).resolves.toBeNull();
    } finally {
      await prisma.$executeRawUnsafe(
        `DROP TRIGGER IF EXISTS "${triggerName}" ON "Inventory"`,
      );
      await prisma.$executeRawUnsafe(
        `DROP FUNCTION IF EXISTS "${functionName}"()`,
      );
    }
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

  it("persists and maps category UUIDs when creating and reassigning products", async () => {
    const firstCategory = createTestCategory();
    const secondCategory = createTestCategory();
    const product = createTestProduct({ categoryUuid: firstCategory.uuid });
    createdCategoryUuids.push(firstCategory.uuid, secondCategory.uuid);
    createdProductUuids.push(product.uuid);
    await Promise.all([
      categoryRepository.create(firstCategory),
      categoryRepository.create(secondCategory),
    ]);

    await expect(repository.create(product)).resolves.toEqual(product);

    const reassignedProduct = updateProduct(
      product,
      { categoryUuid: secondCategory.uuid },
      new Date("2026-09-23T11:00:00.000Z"),
    );

    await expect(repository.update(reassignedProduct)).resolves.toEqual(
      reassignedProduct,
    );
    await expect(repository.findByUuid(product.uuid)).resolves.toEqual(
      reassignedProduct,
    );
  });

  it("rejects missing and inactive category associations as conflicts", async () => {
    const inactiveCategory = createTestCategory({ isActive: false });
    createdCategoryUuids.push(inactiveCategory.uuid);
    await categoryRepository.create(inactiveCategory);

    await expect(
      repository.create(createTestProduct({ categoryUuid: randomUUID() })),
    ).rejects.toThrow(ProductCategoryAssignmentConflictError);
    await expect(
      repository.create(
        createTestProduct({ categoryUuid: inactiveCategory.uuid }),
      ),
    ).rejects.toThrow(ProductCategoryAssignmentConflictError);
  });

  it("translates an association that loses a deactivation race into a conflict", async () => {
    const category = createTestCategory();
    const product = createTestProduct({ categoryUuid: category.uuid });
    createdCategoryUuids.push(category.uuid);
    createdProductUuids.push(product.uuid);
    await categoryRepository.create(category);
    const deactivatedCategory = updateCategory(
      category,
      { isActive: false },
      new Date("2026-09-23T11:00:00.000Z"),
    );

    const [association, deactivation] = await Promise.all([
      repository
        .create(product)
        .then(() => "created" as const)
        .catch((error: unknown) => {
          if (error instanceof ProductCategoryAssignmentConflictError) {
            return "conflict" as const;
          }

          throw error;
        }),
      categoryRepository.updateIfUnused(deactivatedCategory),
    ]);

    if (association === "created") {
      expect(deactivation).toBe("in_use");
    } else {
      expect(deactivation).toEqual(deactivatedCategory);
    }
  });

  it("translates an association that loses a deletion race into a conflict", async () => {
    const category = createTestCategory();
    const product = createTestProduct({ categoryUuid: category.uuid });
    createdCategoryUuids.push(category.uuid);
    createdProductUuids.push(product.uuid);
    await categoryRepository.create(category);

    const [association, deletion] = await Promise.all([
      repository
        .create(product)
        .then(() => "created" as const)
        .catch((error: unknown) => {
          if (error instanceof ProductCategoryAssignmentConflictError) {
            return "conflict" as const;
          }

          throw error;
        }),
      categoryRepository.deleteIfUnused(category.uuid),
    ]);

    if (association === "created") {
      expect(deletion).toBe("in_use");
    } else {
      expect(deletion).toBe("deleted");
    }
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
