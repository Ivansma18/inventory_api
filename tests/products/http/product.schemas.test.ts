import { describe, expect, it } from "vitest";

import { createProduct } from "../../../src/features/products/domain/product.entity.js";
import {
  toProductListResponse,
  toProductResponse,
} from "../../../src/features/products/http/product.mapper.js";
import {
  createProductSchema,
  productListQuerySchema,
  productParamsSchema,
  updateProductSchema,
} from "../../../src/features/products/http/product.schemas.js";

describe("Product HTTP schemas", () => {
  it("trims valid create inputs and strips unrecognized properties", () => {
    const result = createProductSchema.parse({
      sku: "  DESK-001  ",
      name: "  Standing desk  ",
      description: "Electric",
      purchasePrice: 100.25,
      salePrice: 150.5,
      ignored: "value",
    });

    expect(result).toEqual({
      sku: "DESK-001",
      name: "Standing desk",
      description: "Electric",
      purchasePrice: 100.25,
      salePrice: 150.5,
    });
  });

  it("rejects missing or invalid product fields", () => {
    expect(() =>
      createProductSchema.parse({
        sku: "   ",
        name: "Desk",
        purchasePrice: 10,
        salePrice: 20,
      }),
    ).toThrow();
    expect(() =>
      createProductSchema.parse({
        sku: "DESK-001",
        name: "Desk",
        purchasePrice: -1,
        salePrice: 20,
      }),
    ).toThrow();
    expect(() =>
      createProductSchema.parse({
        sku: "DESK-001",
        name: "Desk",
        purchasePrice: 10.001,
        salePrice: 20,
      }),
    ).toThrow();
  });

  it("preserves nullable descriptions, strips extra update properties, and rejects empty updates", () => {
    expect(
      updateProductSchema.parse({ description: null, ignored: "value" }),
    ).toEqual({ description: null });
    expect(() => updateProductSchema.parse({ ignored: "value" })).toThrow();
  });

  it("validates UUID params and coerces valid list query parameters", () => {
    expect(
      productParamsSchema.parse({
        uuid: "550e8400-e29b-41d4-a716-446655440000",
      }),
    ).toEqual({ uuid: "550e8400-e29b-41d4-a716-446655440000" });
    expect(() => productParamsSchema.parse({ uuid: "not-a-uuid" })).toThrow();

    expect(
      productListQuerySchema.parse({
        page: "2",
        limit: "25",
        search: "  desk  ",
        isActive: "false",
        sort: "salePrice",
        order: "desc",
      }),
    ).toEqual({
      page: 2,
      limit: 25,
      search: "  desk  ",
      isActive: false,
      sort: "salePrice",
      order: "desc",
    });
  });

  it("rejects invalid pagination, state, sort, and order query values", () => {
    for (const query of [
      { page: "0" },
      { limit: "101" },
      { page: "1.5" },
      { isActive: "yes" },
      { sort: "id" },
      { order: "ascending" },
    ]) {
      expect(() => productListQuerySchema.parse(query)).toThrow();
    }
  });
});

describe("Product HTTP mappers", () => {
  it("serializes public product data without persistence-only fields", () => {
    const product = createProduct({
      uuid: "550e8400-e29b-41d4-a716-446655440000",
      sku: "DESK-001",
      name: "Standing desk",
      description: null,
      purchasePrice: 100.25,
      salePrice: 150.5,
      createdAt: new Date("2026-09-23T10:00:00.000Z"),
      updatedAt: new Date("2026-09-23T11:00:00.000Z"),
    });

    expect(toProductResponse(product)).toEqual({
      uuid: product.uuid,
      sku: product.sku,
      name: product.name,
      description: null,
      purchasePrice: product.purchasePrice,
      salePrice: product.salePrice,
      isActive: true,
      createdAt: "2026-09-23T10:00:00.000Z",
      updatedAt: "2026-09-23T11:00:00.000Z",
    });
    expect(toProductResponse(product)).not.toHaveProperty("skuNormalized");

    expect(
      toProductListResponse({ products: [product], total: 1 }, 1, 15),
    ).toEqual({
      data: [toProductResponse(product)],
      pagination: { total: 1, page: 1, limit: 15 },
    });
  });
});
