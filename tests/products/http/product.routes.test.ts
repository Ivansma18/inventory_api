import { describe, expect, it } from "vitest";

import { createProduct } from "../../../src/features/products/domain/product.entity.js";
import {
  ProductNotFoundError,
  ProductSkuAlreadyExistsError,
} from "../../../src/features/products/domain/product.errors.js";
import {
  createProductRoutes,
  type ProductHttpService,
} from "../../../src/features/products/http/product.routes.js";

const product = createProduct({
  uuid: "550e8400-e29b-41d4-a716-446655440000",
  sku: "DESK-001",
  name: "Standing desk",
  description: "Electric",
  purchasePrice: 100.25,
  salePrice: 150.5,
  createdAt: new Date("2026-09-23T10:00:00.000Z"),
  updatedAt: new Date("2026-09-23T10:00:00.000Z"),
});

function createService(
  overrides: Partial<ProductHttpService> = {},
): ProductHttpService {
  return {
    createProduct: async () => product,
    getProduct: async () => product,
    listProducts: async () => ({ products: [product], total: 1 }),
    updateProduct: async () => product,
    ...overrides,
  };
}

describe("Product routes", () => {
  it("creates products from recognized fields and returns public data", async () => {
    let receivedInput: unknown;
    const app = createProductRoutes({
      service: createService({
        createProduct: async (input) => {
          receivedInput = input;
          return product;
        },
      }),
    });

    const response = await app.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sku: "  DESK-001  ",
        name: "  Standing desk  ",
        purchasePrice: 100.25,
        salePrice: 150.5,
        ignored: "value",
      }),
    });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      data: {
        uuid: product.uuid,
        sku: product.sku,
        name: product.name,
        description: product.description,
        purchasePrice: product.purchasePrice,
        salePrice: product.salePrice,
        isActive: product.isActive,
        createdAt: "2026-09-23T10:00:00.000Z",
        updatedAt: "2026-09-23T10:00:00.000Z",
      },
    });
    expect(receivedInput).toEqual({
      sku: "DESK-001",
      name: "Standing desk",
      purchasePrice: 100.25,
      salePrice: 150.5,
    });
  });

  it("returns 400 for invalid creation inputs and invalid UUIDs", async () => {
    const app = createProductRoutes({ service: createService() });

    const [invalidProduct, invalidUuid] = await Promise.all([
      app.request("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sku: "",
          name: "Desk",
          purchasePrice: 100,
          salePrice: 150,
        }),
      }),
      app.request("/not-a-uuid"),
    ]);

    expect(invalidProduct.status).toBe(400);
    expect(invalidUuid.status).toBe(400);
  });

  it("gets a product and translates not-found errors", async () => {
    const foundApp = createProductRoutes({ service: createService() });
    const missingApp = createProductRoutes({
      service: createService({
        getProduct: async () => {
          throw new ProductNotFoundError();
        },
      }),
    });

    const [found, missing] = await Promise.all([
      foundApp.request(`/${product.uuid}`),
      missingApp.request(`/${product.uuid}`),
    ]);

    expect(found.status).toBe(200);
    await expect(found.json()).resolves.toMatchObject({
      data: { uuid: product.uuid, isActive: true },
    });
    expect(missing.status).toBe(404);
    await expect(missing.json()).resolves.toEqual({
      error: {
        code: "PRODUCT_NOT_FOUND",
        message: "Product was not found.",
      },
    });
  });

  it("updates recognized fields and translates SKU conflicts", async () => {
    let receivedUuid: string | undefined;
    let receivedInput: unknown;
    const updatedProduct = { ...product, description: null, isActive: false };
    const app = createProductRoutes({
      service: createService({
        updateProduct: async (uuid, input) => {
          receivedUuid = uuid;
          receivedInput = input;
          return updatedProduct;
        },
      }),
    });
    const conflictApp = createProductRoutes({
      service: createService({
        updateProduct: async () => {
          throw new ProductSkuAlreadyExistsError();
        },
      }),
    });

    const response = await app.request(`/${product.uuid}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description: null,
        isActive: false,
        ignored: true,
      }),
    });
    const conflict = await conflictApp.request(`/${product.uuid}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sku: "OTHER-001" }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: { description: null, isActive: false },
    });
    expect(receivedUuid).toBe(product.uuid);
    expect(receivedInput).toEqual({ description: null, isActive: false });
    expect(conflict.status).toBe(409);
    await expect(conflict.json()).resolves.toEqual({
      error: {
        code: "PRODUCT_SKU_ALREADY_EXISTS",
        message: "Product SKU already exists.",
      },
    });
  });

  it("returns 400 when an update has no recognized fields", async () => {
    const app = createProductRoutes({ service: createService() });

    const response = await app.request(`/${product.uuid}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ignored: true }),
    });

    expect(response.status).toBe(400);
  });

  it("lists products with the query filters and pagination supplied to the service", async () => {
    let receivedInput: unknown;
    const app = createProductRoutes({
      service: createService({
        listProducts: async (input) => {
          receivedInput = input;
          return { products: [product], total: 3 };
        },
      }),
    });

    const response = await app.request(
      "/?page=2&limit=25&search=%20desk%20&isActive=false&sort=salePrice&order=desc",
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: [{ uuid: product.uuid }],
      pagination: { total: 3, page: 2, limit: 25 },
    });
    expect(receivedInput).toEqual({
      page: 2,
      limit: 25,
      search: " desk ",
      isActive: false,
      sort: "salePrice",
      order: "desc",
    });
  });

  it("uses pagination defaults and rejects invalid list queries", async () => {
    let receivedInput: unknown;
    const app = createProductRoutes({
      service: createService({
        listProducts: async (input) => {
          receivedInput = input;
          return { products: [], total: 0 };
        },
      }),
    });

    const [defaultQuery, invalidQuery] = await Promise.all([
      app.request("/"),
      app.request("/?limit=101"),
    ]);

    expect(defaultQuery.status).toBe(200);
    await expect(defaultQuery.json()).resolves.toEqual({
      data: [],
      pagination: { total: 0, page: 1, limit: 15 },
    });
    expect(receivedInput).toEqual({});
    expect(invalidQuery.status).toBe(400);
  });
});
