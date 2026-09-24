import { describe, expect, it } from "vitest";

import { InventoryProductNotFoundError } from "../../../src/features/inventory/domain/inventory.errors.js";
import {
  inventoryListTieBreakers,
  inventorySortFields,
  type InventoryRepository,
} from "../../../src/features/inventory/domain/inventory.repository.js";

describe("Inventory repository contract", () => {
  it("defines the supported sorting and stable tie breakers", () => {
    expect(inventorySortFields).toEqual([
      "name",
      "sku",
      "quantity",
      "minimumStock",
      "updatedAt",
    ]);
    expect(inventoryListTieBreakers).toEqual([
      { sort: "sku", order: "asc" },
      { sort: "productUuid", order: "asc" },
    ]);
  });

  it("exposes detail, list, and minimum stock update operations", () => {
    const repository: InventoryRepository = {
      findByProductUuid: async () => null,
      findMany: async () => ({ inventories: [], total: 0 }),
      updateMinimumStock: async (inventory) => inventory,
    };

    expect(repository).toHaveProperty("findByProductUuid");
    expect(repository).toHaveProperty("findMany");
    expect(repository).toHaveProperty("updateMinimumStock");
  });

  it("identifies a missing inventory product as a domain error", () => {
    expect(new InventoryProductNotFoundError()).toMatchObject({
      name: "InventoryProductNotFoundError",
      message: "Inventory product was not found.",
    });
  });
});
