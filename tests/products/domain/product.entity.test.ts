import { describe, expect, it } from "vitest";

import {
  InvalidProductNameError,
  InvalidProductPriceError,
  InvalidProductSkuError,
} from "../../../src/features/products/domain/product.errors.js";
import {
  type CreateProductData,
  createProduct,
  updateProduct,
} from "../../../src/features/products/domain/product.entity.js";

const createdAt = new Date("2026-09-23T10:00:00.000Z");

function createInvalidProductData(
  data: Record<string, unknown>,
): CreateProductData {
  return data as unknown as CreateProductData;
}

function createValidProduct() {
  return createProduct({
    uuid: "b1c7b78c-7f8d-4d4a-a01a-2e8d41dfb15d",
    sku: "  desk-001  ",
    name: "  Standing desk  ",
    description: "Electric desk",
    purchasePrice: 100.25,
    salePrice: 149.99,
    categoryUuid: null,
    createdAt,
    updatedAt: createdAt,
  });
}

describe("Product", () => {
  it("creates an active product with normalized SKU and trimmed name", () => {
    expect(createValidProduct()).toEqual({
      uuid: "b1c7b78c-7f8d-4d4a-a01a-2e8d41dfb15d",
      sku: "desk-001",
      skuNormalized: "desk-001",
      name: "Standing desk",
      description: "Electric desk",
      purchasePrice: 100.25,
      salePrice: 149.99,
      isActive: true,
      categoryUuid: null,
      createdAt,
      updatedAt: createdAt,
    });
  });

  it.each([undefined, "", "   "])("rejects an invalid SKU: %j", (sku) => {
    expect(() =>
      createProduct(
        createInvalidProductData({
          ...createValidProduct(),
          sku,
          createdAt,
          updatedAt: createdAt,
        }),
      ),
    ).toThrow(InvalidProductSkuError);
  });

  it.each([undefined, "", "   "])("rejects an invalid name: %j", (name) => {
    expect(() =>
      createProduct(
        createInvalidProductData({
          ...createValidProduct(),
          name,
          createdAt,
          updatedAt: createdAt,
        }),
      ),
    ).toThrow(InvalidProductNameError);
  });

  it.each([-0.01, 1.001, Number.POSITIVE_INFINITY])(
    "rejects an invalid purchase price: %s",
    (purchasePrice) => {
      expect(() =>
        createProduct({
          ...createValidProduct(),
          purchasePrice,
          createdAt,
          updatedAt: createdAt,
        }),
      ).toThrow(InvalidProductPriceError);
    },
  );

  it.each([-0.01, 1.001, Number.NaN])(
    "rejects an invalid sale price: %s",
    (salePrice) => {
      expect(() =>
        createProduct({
          ...createValidProduct(),
          salePrice,
          createdAt,
          updatedAt: createdAt,
        }),
      ).toThrow(InvalidProductPriceError);
    },
  );

  it("accepts zero prices", () => {
    expect(
      createProduct({
        ...createValidProduct(),
        purchasePrice: 0,
        salePrice: 0,
        createdAt,
        updatedAt: createdAt,
      }),
    ).toMatchObject({ purchasePrice: 0, salePrice: 0 });
  });

  it("preserves omitted fields and applies explicit null during an update", () => {
    const product = createValidProduct();
    const updatedAt = new Date("2026-09-23T11:00:00.000Z");

    const renamed = updateProduct(
      product,
      { name: "  Adjustable desk  " },
      updatedAt,
    );
    const withoutDescription = updateProduct(
      renamed,
      { description: null },
      updatedAt,
    );

    expect(renamed).toMatchObject({
      name: "Adjustable desk",
      description: "Electric desk",
      isActive: true,
      updatedAt,
    });
    expect(withoutDescription).toMatchObject({ description: null, updatedAt });
  });

  it("preserves an omitted category and assigns a provided category UUID", () => {
    const product = createValidProduct();
    const categoryUuid = "550e8400-e29b-41d4-a716-446655440000";

    expect(
      updateProduct(product, { name: "Updated desk" }, createdAt),
    ).toMatchObject({ categoryUuid: null });
    expect(updateProduct(product, { categoryUuid }, createdAt)).toMatchObject({
      categoryUuid,
    });
  });
});
