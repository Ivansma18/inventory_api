import { describe, expect, it } from "vitest";

import {
  InsufficientStockError,
  InvalidStockAdjustmentQuantityError,
  InvalidStockMovementPreviousStockError,
  InvalidStockMovementQuantityError,
} from "../../../src/features/stock-movements/domain/stock-movement.errors.js";
import {
  createStockAdjustment,
  createStockEntry,
  createStockExit,
} from "../../../src/features/stock-movements/domain/stock-movement.entity.js";

const createdAt = new Date("2026-09-25T10:00:00.000Z");
const productUuid = "550e8400-e29b-41d4-a716-446655440000";

describe("StockMovement", () => {
  it("creates an entry that increases stock", () => {
    expect(
      createStockEntry({
        uuid: "b1c7b78c-7f8d-4d4a-a01a-2e8d41dfb15d",
        productUuid,
        quantity: 4,
        previousStock: 6,
        reference: "PURCHASE-001",
        createdAt,
      }),
    ).toEqual({
      uuid: "b1c7b78c-7f8d-4d4a-a01a-2e8d41dfb15d",
      productUuid,
      type: "IN",
      quantity: 4,
      previousStock: 6,
      newStock: 10,
      reason: null,
      reference: "PURCHASE-001",
      createdAt,
    });
  });

  it("creates an exit that decreases stock", () => {
    expect(
      createStockExit({
        uuid: "23cb739d-1b93-485b-b36d-b2aea64e8571",
        productUuid,
        quantity: 4,
        previousStock: 6,
        reference: null,
        createdAt,
      }),
    ).toMatchObject({
      type: "OUT",
      quantity: 4,
      previousStock: 6,
      newStock: 2,
      reason: null,
      reference: null,
    });
  });

  it("creates an adjustment whose quantity is the requested final stock", () => {
    expect(
      createStockAdjustment({
        uuid: "10ba80e6-e5e5-4459-8093-799eac7e37b5",
        productUuid,
        quantity: 0,
        previousStock: 6,
        reason: "Inventory count",
        reference: null,
        createdAt,
      }),
    ).toMatchObject({
      type: "ADJUSTMENT",
      quantity: 0,
      previousStock: 6,
      newStock: 0,
      reason: "Inventory count",
      reference: null,
    });
  });

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects an invalid entry or exit quantity: %s",
    (quantity) => {
      const data = {
        uuid: "b1c7b78c-7f8d-4d4a-a01a-2e8d41dfb15d",
        productUuid,
        quantity,
        previousStock: 6,
        reference: null,
        createdAt,
      };

      expect(() => createStockEntry(data)).toThrow(
        InvalidStockMovementQuantityError,
      );
      expect(() => createStockExit(data)).toThrow(
        InvalidStockMovementQuantityError,
      );
    },
  );

  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects an invalid adjustment quantity: %s",
    (quantity) => {
      expect(() =>
        createStockAdjustment({
          uuid: "10ba80e6-e5e5-4459-8093-799eac7e37b5",
          productUuid,
          quantity,
          previousStock: 6,
          reason: "Inventory count",
          reference: null,
          createdAt,
        }),
      ).toThrow(InvalidStockAdjustmentQuantityError);
    },
  );

  it("rejects an exit that exceeds the confirmed stock", () => {
    expect(() =>
      createStockExit({
        uuid: "23cb739d-1b93-485b-b36d-b2aea64e8571",
        productUuid,
        quantity: 7,
        previousStock: 6,
        reference: null,
        createdAt,
      }),
    ).toThrow(InsufficientStockError);
  });

  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects an invalid confirmed stock: %s",
    (previousStock) => {
      expect(() =>
        createStockEntry({
          uuid: "b1c7b78c-7f8d-4d4a-a01a-2e8d41dfb15d",
          productUuid,
          quantity: 1,
          previousStock,
          reference: null,
          createdAt,
        }),
      ).toThrow(InvalidStockMovementPreviousStockError);
    },
  );
});
