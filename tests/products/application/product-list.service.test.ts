import { describe, expect, it } from "vitest";

import { ProductService } from "../../../src/features/products/application/product.service.js";
import {
  createProduct,
  type Product,
} from "../../../src/features/products/domain/product.entity.js";
import type {
  ProductListQuery,
  ProductListResult,
  ProductRepository,
} from "../../../src/features/products/domain/product.repository.js";

class ProductListSpyRepository implements ProductRepository {
  receivedQuery: ProductListQuery | undefined;

  constructor(private readonly result: ProductListResult) {}

  async create(product: Product): Promise<Product> {
    return product;
  }

  async findBySkuNormalized(): Promise<Product | null> {
    return null;
  }

  async findByUuid(): Promise<Product | null> {
    return null;
  }

  async findMany(query: ProductListQuery): Promise<ProductListResult> {
    this.receivedQuery = query;
    return this.result;
  }

  async update(product: Product): Promise<Product> {
    return product;
  }
}

function createListedProduct(): Product {
  const timestamp = new Date("2026-09-23T10:00:00.000Z");

  return createProduct({
    uuid: "b1c7b78c-7f8d-4d4a-a01a-2e8d41dfb15d",
    sku: "SKU-001",
    name: "Desk",
    purchasePrice: 100,
    salePrice: 150,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
}

function createService(total = 1) {
  const product = createListedProduct();
  const repository = new ProductListSpyRepository({
    products: [product],
    total,
  });

  return { product, repository, service: new ProductService(repository) };
}

describe("ProductService.listProducts", () => {
  it("uses active products, pagination and name ordering by default", async () => {
    const { product, repository, service } = createService(3);

    await expect(service.listProducts()).resolves.toEqual({
      products: [product],
      total: 3,
    });
    expect(repository.receivedQuery).toEqual({
      page: 1,
      limit: 15,
      isActive: true,
      sort: "name",
      order: "asc",
      tieBreakers: [
        { sort: "createdAt", order: "asc" },
        { sort: "uuid", order: "asc" },
      ],
    });
  });

  it("passes search and state filters together with the requested pagination and ordering", async () => {
    const { repository, service } = createService();

    await service.listProducts({
      page: 2,
      limit: 25,
      search: "  desk  ",
      isActive: false,
      sort: "salePrice",
      order: "desc",
    });

    expect(repository.receivedQuery).toMatchObject({
      page: 2,
      limit: 25,
      search: "desk",
      isActive: false,
      sort: "salePrice",
      order: "desc",
      tieBreakers: [
        { sort: "createdAt", order: "asc" },
        { sort: "uuid", order: "asc" },
      ],
    });
  });

  it("treats blank search as omitted", async () => {
    const { repository, service } = createService();

    await service.listProducts({ search: "   " });

    expect(repository.receivedQuery).not.toHaveProperty("search");
  });
});
