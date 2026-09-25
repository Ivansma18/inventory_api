import { describe, expect, it } from "vitest";

import {
  inventoryDataResponseSchema,
  inventoryListQuerySchema,
  inventoryListResponseSchema,
  inventoryParamsSchema,
  inventoryResponseSchema,
  updateMinimumStockSchema,
} from "../../../src/features/inventory/http/inventory.schemas.js";

describe("Inventory HTTP schemas", () => {
  it("validates product UUID params and coerces supported list query values", () => {
    expect(
      inventoryParamsSchema.parse({
        productUuid: "550e8400-e29b-41d4-a716-446655440000",
      }),
    ).toEqual({ productUuid: "550e8400-e29b-41d4-a716-446655440000" });
    expect(() =>
      inventoryParamsSchema.parse({ productUuid: "not-a-uuid" }),
    ).toThrow();

    expect(
      inventoryListQuerySchema.parse({
        page: "2",
        limit: "25",
        search: "  desk  ",
        isActive: "false",
        status: "LOW_STOCK",
        sort: "minimumStock",
        order: "desc",
      }),
    ).toEqual({
      page: 2,
      limit: 25,
      search: "  desk  ",
      isActive: false,
      status: "LOW_STOCK",
      sort: "minimumStock",
      order: "desc",
    });
  });

  it("rejects invalid list filters, pagination, sorting, and order", () => {
    for (const query of [
      { page: "0" },
      { limit: "101" },
      { page: "1.5" },
      { isActive: "yes" },
      { status: "EMPTY" },
      { sort: "id" },
      { order: "ascending" },
    ]) {
      expect(() => inventoryListQuerySchema.parse(query)).toThrow();
    }
  });

  it("strips unknown minimum stock fields and accepts only non-negative integers", () => {
    expect(
      updateMinimumStockSchema.parse({ minimumStock: 0, ignored: "value" }),
    ).toEqual({ minimumStock: 0 });

    for (const body of [
      {},
      { ignored: "value" },
      { minimumStock: null },
      { minimumStock: "2" },
      { minimumStock: 1.5 },
      { minimumStock: -1 },
    ]) {
      expect(() => updateMinimumStockSchema.parse(body)).toThrow();
    }
  });

  it("defines the complete public inventory response", () => {
    const inventory = {
      productUuid: "550e8400-e29b-41d4-a716-446655440000",
      sku: "DESK-001",
      name: "Standing desk",
      categoryUuid: "550e8400-e29b-41d4-a716-446655440001",
      isActive: true,
      quantity: 5,
      minimumStock: 2,
      status: "IN_STOCK",
      updatedAt: "2026-09-24T11:00:00.000Z",
    };

    expect(inventoryResponseSchema.parse(inventory)).toMatchObject({
      quantity: 5,
      status: "IN_STOCK",
    });
    expect(inventoryDataResponseSchema.parse({ data: inventory })).toEqual({
      data: inventory,
    });
    expect(
      inventoryListResponseSchema.parse({
        data: [inventory],
        pagination: { total: 1, page: 1, limit: 15 },
      }),
    ).toMatchObject({ pagination: { total: 1, page: 1, limit: 15 } });
    expect(() =>
      inventoryResponseSchema.parse({
        productUuid: "550e8400-e29b-41d4-a716-446655440000",
      }),
    ).toThrow();
  });
});
