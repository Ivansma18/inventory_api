import { describe, expect, it } from "vitest";

import {
  InvalidInventoryMinimumStockError,
  InvalidInventoryQuantityError,
} from "../../../src/features/inventory/domain/inventory.errors.js";
import {
  createInventory,
  getInventoryStatus,
  updateMinimumStock,
} from "../../../src/features/inventory/domain/inventory.entity.js";

const createdAt = new Date("2026-09-24T10:00:00.000Z");
const updatedAt = new Date("2026-09-24T11:00:00.000Z");

function createValidInventory(
  overrides: Partial<{
    quantity: number;
    minimumStock: number;
  }> = {},
) {
  return createInventory({
    uuid: "b1c7b78c-7f8d-4d4a-a01a-2e8d41dfb15d",
    productUuid: "550e8400-e29b-41d4-a716-446655440000",
    sku: "DESK-001",
    name: "Desk",
    categoryUuid: "177c46a4-33c4-4c1e-a0ff-485dfb7591d7",
    isActive: true,
    quantity: 0,
    minimumStock: 0,
    updatedAt: createdAt,
    ...overrides,
  });
}

describe("Inventory", () => {
  it("creates an inventory with non-negative integer quantities", () => {
    expect(createValidInventory({ quantity: 4, minimumStock: 2 })).toEqual({
      uuid: "b1c7b78c-7f8d-4d4a-a01a-2e8d41dfb15d",
      productUuid: "550e8400-e29b-41d4-a716-446655440000",
      sku: "DESK-001",
      name: "Desk",
      categoryUuid: "177c46a4-33c4-4c1e-a0ff-485dfb7591d7",
      isActive: true,
      quantity: 4,
      minimumStock: 2,
      updatedAt: createdAt,
    });
  });

  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects an invalid quantity: %s",
    (quantity) => {
      expect(() => createValidInventory({ quantity })).toThrow(
        InvalidInventoryQuantityError,
      );
    },
  );

  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects an invalid minimum stock: %s",
    (minimumStock) => {
      expect(() => createValidInventory({ minimumStock })).toThrow(
        InvalidInventoryMinimumStockError,
      );
    },
  );

  it("calculates inventory status from quantity and minimum stock", () => {
    expect(getInventoryStatus(createValidInventory())).toBe("OUT_OF_STOCK");
    expect(
      getInventoryStatus(
        createValidInventory({ quantity: 2, minimumStock: 2 }),
      ),
    ).toBe("LOW_STOCK");
    expect(
      getInventoryStatus(
        createValidInventory({ quantity: 3, minimumStock: 2 }),
      ),
    ).toBe("IN_STOCK");
  });

  it("updates the minimum stock without changing quantity", () => {
    const inventory = createValidInventory({ quantity: 5, minimumStock: 2 });

    expect(updateMinimumStock(inventory, 3, updatedAt)).toEqual({
      ...inventory,
      minimumStock: 3,
      updatedAt,
    });
    expect(updateMinimumStock(inventory, 2, updatedAt)).toEqual({
      ...inventory,
      updatedAt,
    });
  });
});
