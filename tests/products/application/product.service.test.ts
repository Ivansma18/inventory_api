import { describe, expect, it } from "vitest";

import {
  createProduct,
  updateProduct,
  type Product,
} from "../../../src/features/products/domain/product.entity.js";
import {
  ProductCategoryInactiveError,
  ProductCategoryNotFoundError,
  ProductNotFoundError,
  ProductSkuAlreadyExistsError,
} from "../../../src/features/products/domain/product.errors.js";
import type {
  ProductListResult,
  ProductRepository,
} from "../../../src/features/products/domain/product.repository.js";
import { ProductService } from "../../../src/features/products/application/product.service.js";
import type { CategoryReader } from "../../../src/features/categories/index.js";

class FakeProductRepository implements ProductRepository {
  private readonly products = new Map<string, Product>();

  constructor(products: Product[] = []) {
    for (const product of products) {
      this.products.set(product.uuid, product);
    }
  }

  async create(product: Product): Promise<Product> {
    this.products.set(product.uuid, product);
    return product;
  }

  async findBySkuNormalized(skuNormalized: string): Promise<Product | null> {
    return (
      [...this.products.values()].find(
        (product) => product.skuNormalized === skuNormalized,
      ) ?? null
    );
  }

  async findByUuid(uuid: string): Promise<Product | null> {
    return this.products.get(uuid) ?? null;
  }

  async findMany(): Promise<ProductListResult> {
    throw new Error("Listing is not part of this fake repository yet.");
  }

  async update(product: Product): Promise<Product> {
    this.products.set(product.uuid, product);
    return product;
  }
}

function createStoredProduct(overrides: Partial<Product> = {}): Product {
  const createdAt = new Date("2026-09-23T10:00:00.000Z");

  return {
    ...createProduct({
      uuid: "b1c7b78c-7f8d-4d4a-a01a-2e8d41dfb15d",
      sku: "SKU-001",
      name: "Desk",
      description: "Electric desk",
      purchasePrice: 100,
      salePrice: 150,
      createdAt,
      updatedAt: createdAt,
    }),
    ...overrides,
  };
}

function createService(
  products: Product[] = [],
  categories: Record<string, boolean> = {
    "550e8400-e29b-41d4-a716-446655440000": true,
  },
) {
  const repository = new FakeProductRepository(products);
  const categoryReader: CategoryReader = {
    findByUuid: async (uuid) => {
      const isActive = categories[uuid];

      return isActive === undefined ? null : { uuid, isActive };
    },
  };
  const timestamp = new Date("2026-09-23T11:00:00.000Z");
  const service = new ProductService(
    repository,
    categoryReader,
    () => "e3b0c442-98fc-4c14-9afb-0d8ac4e6f4b1",
    () => timestamp,
  );

  return { repository, service, timestamp };
}

describe("ProductService", () => {
  it("creates an active product with a generated UUID and timestamps", async () => {
    const { service, timestamp } = createService();

    const product = await service.createProduct({
      sku: "  desk-002  ",
      name: "  Adjustable desk  ",
      purchasePrice: 120,
      salePrice: 180,
      categoryUuid: "550e8400-e29b-41d4-a716-446655440000",
    });

    expect(product).toEqual({
      uuid: "e3b0c442-98fc-4c14-9afb-0d8ac4e6f4b1",
      sku: "desk-002",
      skuNormalized: "desk-002",
      name: "Adjustable desk",
      description: null,
      purchasePrice: 120,
      salePrice: 180,
      isActive: true,
      categoryUuid: "550e8400-e29b-41d4-a716-446655440000",
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  });

  it("rejects a duplicate SKU even when the existing product is inactive", async () => {
    const inactiveProduct = updateProduct(
      createStoredProduct(),
      { isActive: false },
      new Date("2026-09-23T10:01:00.000Z"),
    );
    const { service } = createService([inactiveProduct]);

    await expect(
      service.createProduct({
        sku: "  sku-001  ",
        name: "Another desk",
        purchasePrice: 90,
        salePrice: 140,
        categoryUuid: "550e8400-e29b-41d4-a716-446655440000",
      }),
    ).rejects.toThrow(ProductSkuAlreadyExistsError);
  });

  it("returns a product by UUID and rejects an unknown UUID", async () => {
    const storedProduct = createStoredProduct();
    const { service } = createService([storedProduct]);

    await expect(service.getProduct(storedProduct.uuid)).resolves.toEqual(
      storedProduct,
    );
    await expect(service.getProduct("unknown")).rejects.toThrow(
      ProductNotFoundError,
    );
  });

  it("updates only provided fields and preserves omitted description and state", async () => {
    const storedProduct = createStoredProduct();
    const { service, timestamp } = createService([storedProduct]);

    const updated = await service.updateProduct(storedProduct.uuid, {
      name: "  Updated desk  ",
      salePrice: 175,
    });

    expect(updated).toMatchObject({
      name: "Updated desk",
      salePrice: 175,
      description: "Electric desk",
      isActive: true,
      updatedAt: timestamp,
    });
  });

  it("removes a description when it is explicitly null", async () => {
    const storedProduct = createStoredProduct();
    const { service } = createService([storedProduct]);

    await expect(
      service.updateProduct(storedProduct.uuid, { description: null }),
    ).resolves.toMatchObject({ description: null });
  });

  it("allows a product to keep its own normalized SKU", async () => {
    const storedProduct = createStoredProduct();
    const { service } = createService([storedProduct]);

    await expect(
      service.updateProduct(storedProduct.uuid, { sku: "  sku-001  " }),
    ).resolves.toMatchObject({ sku: "sku-001", skuNormalized: "sku-001" });
  });

  it("rejects an update that takes another product SKU", async () => {
    const firstProduct = createStoredProduct();
    const secondProduct = createStoredProduct({
      uuid: "6f7d1c9e-98fc-4c14-9afb-0d8ac4e6f4b1",
      sku: "SKU-002",
      skuNormalized: "sku-002",
    });
    const { service } = createService([firstProduct, secondProduct]);

    await expect(
      service.updateProduct(secondProduct.uuid, { sku: "sku-001" }),
    ).rejects.toThrow(ProductSkuAlreadyExistsError);
  });

  it("changes state idempotently", async () => {
    const storedProduct = createStoredProduct();
    const { service } = createService([storedProduct]);

    await service.updateProduct(storedProduct.uuid, { isActive: false });
    await expect(
      service.updateProduct(storedProduct.uuid, { isActive: false }),
    ).resolves.toMatchObject({ isActive: false });

    await service.updateProduct(storedProduct.uuid, { isActive: true });
    await expect(
      service.updateProduct(storedProduct.uuid, { isActive: true }),
    ).resolves.toMatchObject({ isActive: true });
  });

  it("rejects new and assigned categories that do not exist or are inactive", async () => {
    const storedProduct = createStoredProduct();
    const unknownCategoryUuid = "550e8400-e29b-41d4-a716-446655440001";
    const inactiveCategoryUuid = "550e8400-e29b-41d4-a716-446655440002";
    const { service } = createService([storedProduct], {
      [inactiveCategoryUuid]: false,
    });

    await expect(
      service.createProduct({
        sku: "SKU-003",
        name: "Lamp",
        purchasePrice: 20,
        salePrice: 35,
      }),
    ).rejects.toThrow(ProductCategoryNotFoundError);
    await expect(
      service.createProduct({
        sku: "SKU-002",
        name: "Chair",
        purchasePrice: 50,
        salePrice: 75,
        categoryUuid: unknownCategoryUuid,
      }),
    ).rejects.toThrow(ProductCategoryNotFoundError);
    await expect(
      service.updateProduct(storedProduct.uuid, {
        categoryUuid: inactiveCategoryUuid,
      }),
    ).rejects.toThrow(ProductCategoryInactiveError);
  });

  it("validates a supplied category before looking up the product", async () => {
    const unknownCategoryUuid = "550e8400-e29b-41d4-a716-446655440001";
    const { service } = createService([], {});

    await expect(
      service.updateProduct("unknown-product", {
        categoryUuid: unknownCategoryUuid,
      }),
    ).rejects.toThrow(ProductCategoryNotFoundError);
  });

  it("preserves categories omitted from updates, including legacy null values", async () => {
    const categoryUuid = "550e8400-e29b-41d4-a716-446655440000";
    const categorizedProduct = createStoredProduct({ categoryUuid });
    const legacyProduct = createStoredProduct({
      uuid: "6f7d1c9e-98fc-4c14-9afb-0d8ac4e6f4b1",
      categoryUuid: null,
    });
    const { service } = createService([categorizedProduct, legacyProduct]);

    await expect(
      service.updateProduct(categorizedProduct.uuid, { name: "Updated desk" }),
    ).resolves.toMatchObject({ categoryUuid });
    await expect(
      service.updateProduct(legacyProduct.uuid, { name: "Legacy desk" }),
    ).resolves.toMatchObject({ categoryUuid: null });
  });
});
