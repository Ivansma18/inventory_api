import { describe, expect, it } from "vitest";

import { InventoryService } from "../../../src/features/inventory/application/inventory.service.js";
import {
  createInventory,
  type Inventory,
} from "../../../src/features/inventory/domain/inventory.entity.js";
import { InventoryProductNotFoundError } from "../../../src/features/inventory/domain/inventory.errors.js";
import type {
  InventoryListQuery,
  InventoryListResult,
  InventoryRepository,
} from "../../../src/features/inventory/domain/inventory.repository.js";

class FakeInventoryRepository implements InventoryRepository {
  private readonly inventories = new Map<string, Inventory>();
  lastListQuery: InventoryListQuery | undefined;

  constructor(inventories: Inventory[] = []) {
    for (const inventory of inventories) {
      this.inventories.set(inventory.productUuid, inventory);
    }
  }

  async findByProductUuid(productUuid: string): Promise<Inventory | null> {
    return this.inventories.get(productUuid) ?? null;
  }

  async findMany(query: InventoryListQuery): Promise<InventoryListResult> {
    this.lastListQuery = query;
    const inventories = [...this.inventories.values()];

    return { inventories, total: inventories.length };
  }

  async updateMinimumStock(inventory: Inventory): Promise<Inventory> {
    this.inventories.set(inventory.productUuid, inventory);
    return inventory;
  }
}

function createStoredInventory(overrides: Partial<Inventory> = {}): Inventory {
  return createInventory({
    uuid: "b1c7b78c-7f8d-4d4a-a01a-2e8d41dfb15d",
    productUuid: "550e8400-e29b-41d4-a716-446655440000",
    sku: "DESK-001",
    name: "Desk",
    categoryUuid: "177c46a4-33c4-4c1e-a0ff-485dfb7591d7",
    isActive: true,
    quantity: 5,
    minimumStock: 2,
    updatedAt: new Date("2026-09-24T10:00:00.000Z"),
    ...overrides,
  });
}

function createService(inventories: Inventory[] = []) {
  const repository = new FakeInventoryRepository(inventories);
  const timestamp = new Date("2026-09-24T11:00:00.000Z");

  return {
    repository,
    service: new InventoryService(repository, () => timestamp),
    timestamp,
  };
}

describe("InventoryService", () => {
  it("returns inventory details and rejects an unknown product", async () => {
    const inventory = createStoredInventory();
    const { service } = createService([inventory]);

    await expect(
      service.getProductStock(inventory.productUuid),
    ).resolves.toEqual(inventory);
    await expect(service.getProductStock("unknown")).rejects.toThrow(
      InventoryProductNotFoundError,
    );
  });

  it("uses the listing defaults without excluding inactive products", async () => {
    const active = createStoredInventory();
    const inactive = createStoredInventory({
      productUuid: "550e8400-e29b-41d4-a716-446655440001",
      isActive: false,
    });
    const { repository, service } = createService([active, inactive]);

    await expect(service.listInventory()).resolves.toEqual({
      inventories: [active, inactive],
      total: 2,
    });
    expect(repository.lastListQuery).toEqual({
      page: 1,
      limit: 15,
      sort: "name",
      order: "asc",
      tieBreakers: [
        { sort: "sku", order: "asc" },
        { sort: "productUuid", order: "asc" },
      ],
    });
  });

  it("normalizes search and omits it when only whitespace remains", async () => {
    const { repository, service } = createService();

    await service.listInventory({
      search: "  DesK  ",
      page: 2,
      limit: 5,
      isActive: false,
      status: "LOW_STOCK",
      sort: "quantity",
      order: "desc",
    });
    expect(repository.lastListQuery).toMatchObject({
      search: "DesK",
      page: 2,
      limit: 5,
      isActive: false,
      status: "LOW_STOCK",
      sort: "quantity",
      order: "desc",
    });

    await service.listInventory({ search: "   " });
    expect(repository.lastListQuery).not.toHaveProperty("search");
  });

  it("updates the minimum stock without changing quantity, including idempotently", async () => {
    const inactiveInventory = createStoredInventory({ isActive: false });
    const { service, timestamp } = createService([inactiveInventory]);

    await expect(
      service.updateMinimumStock(inactiveInventory.productUuid, 3),
    ).resolves.toEqual({
      ...inactiveInventory,
      minimumStock: 3,
      updatedAt: timestamp,
    });
    await expect(
      service.updateMinimumStock(inactiveInventory.productUuid, 3),
    ).resolves.toMatchObject({ quantity: 5, minimumStock: 3 });
  });
});
