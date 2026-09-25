import { describe, expect, it } from "vitest";

import {
  adjustStockSchema,
  createStockEntrySchema,
  createStockExitSchema,
  stockMovementDataResponseSchema,
  stockMovementErrorResponseSchema,
  stockMovementListQuerySchema,
  stockMovementListResponseSchema,
  stockMovementParamsSchema,
  stockMovementProductListQuerySchema,
  stockMovementResponseSchema,
} from "../../../src/features/stock-movements/http/stock-movement.schemas.js";

const productUuid = "550e8400-e29b-41d4-a716-446655440000";
const movement = {
  uuid: "550e8400-e29b-41d4-a716-446655440001",
  productUuid,
  type: "ADJUSTMENT" as const,
  quantity: 0,
  previousStock: 5,
  newStock: 0,
  reason: "Inventory count",
  reference: null,
  createdAt: "2026-09-25T10:00:00.000Z",
};

describe("Stock movement HTTP schemas", () => {
  it("strips unknown entry and exit body properties", () => {
    expect(
      createStockEntrySchema.parse({
        quantity: 2,
        reference: null,
        reason: "ignored",
        unexpected: true,
      }),
    ).toEqual({ quantity: 2, reference: null });
    expect(
      createStockExitSchema.parse({ quantity: 1, unexpected: true }),
    ).toEqual({ quantity: 1 });
  });

  it("accepts only positive integer quantities for entries and exits", () => {
    for (const schema of [createStockEntrySchema, createStockExitSchema]) {
      for (const body of [
        {},
        { quantity: null },
        { quantity: "1" },
        { quantity: 1.5 },
        { quantity: 0 },
        { quantity: -1 },
        { quantity: 1, reference: 1 },
      ]) {
        expect(() => schema.parse(body)).toThrow();
      }
    }
  });

  it("requires a non-blank adjustment reason and accepts zero as final stock", () => {
    expect(
      adjustStockSchema.parse({
        quantity: 0,
        reason: "  Inventory count  ",
        reference: "COUNT-001",
        unexpected: true,
      }),
    ).toEqual({
      quantity: 0,
      reason: "Inventory count",
      reference: "COUNT-001",
    });

    for (const body of [
      { quantity: 1 },
      { quantity: 1, reason: null },
      { quantity: 1, reason: 1 },
      { quantity: 1, reason: "   " },
      { quantity: -1, reason: "Inventory count" },
      { quantity: 1.5, reason: "Inventory count" },
      { quantity: 1, reason: "Inventory count", reference: false },
    ]) {
      expect(() => adjustStockSchema.parse(body)).toThrow();
    }
  });

  it("validates UUID params and coerces movement list filters", () => {
    expect(stockMovementParamsSchema.parse({ productUuid })).toEqual({
      productUuid,
    });
    expect(() =>
      stockMovementParamsSchema.parse({ productUuid: "invalid" }),
    ).toThrow();

    const query = stockMovementProductListQuerySchema.parse({
      page: "2",
      limit: "25",
      type: "OUT",
      from: "2026-09-01T00:00:00.000Z",
      to: "2026-09-30T23:59:59.999Z",
      reference: "  SALE-001  ",
    });

    expect(query).toEqual({
      page: 2,
      limit: 25,
      type: "OUT",
      from: new Date("2026-09-01T00:00:00.000Z"),
      to: new Date("2026-09-30T23:59:59.999Z"),
      reference: "  SALE-001  ",
    });
    expect(stockMovementListQuerySchema.parse({ productUuid })).toEqual({
      productUuid,
    });
  });

  it("rejects invalid list filters and descending date ranges", () => {
    for (const query of [
      { page: "0" },
      { limit: "101" },
      { page: "1.5" },
      { type: "TRANSFER" },
      { from: "2026-09-01T00:00:00" },
      { reference: 1 },
      { productUuid: "invalid" },
      {
        from: "2026-09-02T00:00:00.000Z",
        to: "2026-09-01T00:00:00.000Z",
      },
    ]) {
      expect(() => stockMovementListQuerySchema.parse(query)).toThrow();
    }
  });

  it("defines complete data, list, and error responses", () => {
    expect(stockMovementResponseSchema.parse(movement)).toEqual(movement);
    expect(stockMovementDataResponseSchema.parse({ data: movement })).toEqual({
      data: movement,
    });
    expect(
      stockMovementListResponseSchema.parse({
        data: [movement],
        pagination: { total: 1, page: 1, limit: 15 },
      }),
    ).toMatchObject({ pagination: { total: 1, page: 1, limit: 15 } });
    expect(
      stockMovementErrorResponseSchema.parse({
        error: { code: "VALIDATION_ERROR", message: "Invalid input" },
      }),
    ).toEqual({
      error: { code: "VALIDATION_ERROR", message: "Invalid input" },
    });
    expect(() =>
      stockMovementResponseSchema.parse({ uuid: movement.uuid }),
    ).toThrow();
  });
});
