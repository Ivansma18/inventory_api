import { describe, expect, it } from "vitest";

import { createInventory } from "../../../src/features/inventory/domain/inventory.entity.js";
import { InventoryProductNotFoundError } from "../../../src/features/inventory/domain/inventory.errors.js";
import {
  createInventoryRoutes,
  type InventoryHttpService,
} from "../../../src/features/inventory/http/inventory.routes.js";

const inventory = createInventory({
  uuid: "b1c7b78c-7f8d-4d4a-a01a-2e8d41dfb15d",
  productUuid: "550e8400-e29b-41d4-a716-446655440000",
  sku: "DESK-001",
  name: "Standing desk",
  categoryUuid: "550e8400-e29b-41d4-a716-446655440001",
  isActive: true,
  quantity: 5,
  minimumStock: 2,
  updatedAt: new Date("2026-09-24T11:00:00.000Z"),
});

function createService(
  overrides: Partial<InventoryHttpService> = {},
): InventoryHttpService {
  return {
    getProductStock: async () => inventory,
    listInventory: async () => ({ inventories: [inventory], total: 1 }),
    updateMinimumStock: async () => inventory,
    ...overrides,
  };
}

describe("Inventory routes", () => {
  it("returns detail data and translates a missing product to 404", async () => {
    const foundApp = createInventoryRoutes({ service: createService() });
    const missingApp = createInventoryRoutes({
      service: createService({
        getProductStock: async () => {
          throw new InventoryProductNotFoundError();
        },
      }),
    });

    const [found, missing] = await Promise.all([
      foundApp.request(`/${inventory.productUuid}`),
      missingApp.request(`/${inventory.productUuid}`),
    ]);

    expect(found.status).toBe(200);
    await expect(found.json()).resolves.toEqual({
      data: {
        productUuid: inventory.productUuid,
        sku: inventory.sku,
        name: inventory.name,
        categoryUuid: inventory.categoryUuid,
        isActive: true,
        quantity: 5,
        minimumStock: 2,
        status: "IN_STOCK",
        updatedAt: "2026-09-24T11:00:00.000Z",
      },
    });
    expect(missing.status).toBe(404);
    await expect(missing.json()).resolves.toEqual({
      error: {
        code: "INVENTORY_PRODUCT_NOT_FOUND",
        message: "Inventory product was not found.",
      },
    });
  });

  it("lists inventory with validated filters and pagination", async () => {
    let receivedInput: unknown;
    const app = createInventoryRoutes({
      service: createService({
        listInventory: async (input) => {
          receivedInput = input;
          return { inventories: [inventory], total: 3 };
        },
      }),
    });

    const response = await app.request(
      "/?page=2&limit=25&search=%20desk%20&isActive=false&status=LOW_STOCK&sort=quantity&order=desc",
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: [{ productUuid: inventory.productUuid, status: "IN_STOCK" }],
      pagination: { total: 3, page: 2, limit: 25 },
    });
    expect(receivedInput).toEqual({
      page: 2,
      limit: 25,
      search: " desk ",
      isActive: false,
      status: "LOW_STOCK",
      sort: "quantity",
      order: "desc",
    });
  });

  it("uses list defaults and rejects invalid query values", async () => {
    let receivedInput: unknown;
    const app = createInventoryRoutes({
      service: createService({
        listInventory: async (input) => {
          receivedInput = input;
          return { inventories: [], total: 0 };
        },
      }),
    });

    const [defaultQuery, invalidQuery] = await Promise.all([
      app.request("/"),
      app.request("/?status=EMPTY"),
    ]);

    expect(defaultQuery.status).toBe(200);
    await expect(defaultQuery.json()).resolves.toEqual({
      data: [],
      pagination: { total: 0, page: 1, limit: 15 },
    });
    expect(receivedInput).toEqual({});
    expect(invalidQuery.status).toBe(400);
  });

  it("updates minimum stock while stripping unknown fields", async () => {
    let receivedProductUuid: string | undefined;
    let receivedMinimumStock: number | undefined;
    const updatedInventory = { ...inventory, minimumStock: 3 };
    const app = createInventoryRoutes({
      service: createService({
        updateMinimumStock: async (productUuid, minimumStock) => {
          receivedProductUuid = productUuid;
          receivedMinimumStock = minimumStock;
          return updatedInventory;
        },
      }),
    });

    const response = await app.request(
      `/${inventory.productUuid}/minimum-stock`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ minimumStock: 3, quantity: 99 }),
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: { minimumStock: 3, quantity: 5 },
    });
    expect(receivedProductUuid).toBe(inventory.productUuid);
    expect(receivedMinimumStock).toBe(3);
  });

  it("rejects invalid UUIDs and minimum stock updates", async () => {
    const app = createInventoryRoutes({ service: createService() });
    const missingApp = createInventoryRoutes({
      service: createService({
        updateMinimumStock: async () => {
          throw new InventoryProductNotFoundError();
        },
      }),
    });

    const [invalidUuid, invalidMinimumStock, unknownFields, missing] =
      await Promise.all([
        app.request("/not-a-uuid"),
        app.request(`/${inventory.productUuid}/minimum-stock`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ minimumStock: 1.5 }),
        }),
        app.request(`/${inventory.productUuid}/minimum-stock`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ quantity: 5 }),
        }),
        missingApp.request(`/${inventory.productUuid}/minimum-stock`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ minimumStock: 3 }),
        }),
      ]);

    expect(invalidUuid.status).toBe(400);
    expect(invalidMinimumStock.status).toBe(400);
    expect(unknownFields.status).toBe(400);
    expect(missing.status).toBe(404);
  });
});
