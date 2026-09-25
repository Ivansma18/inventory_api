import {
  updateMinimumStock,
  type Inventory,
  type InventoryStatus,
} from "../domain/inventory.entity.js";
import { InventoryProductNotFoundError } from "../domain/inventory.errors.js";
import {
  inventoryListTieBreakers,
  type InventoryListResult,
  type InventoryRepository,
  type InventorySortDirection,
  type InventorySortField,
} from "../domain/inventory.repository.js";

export interface ListInventoryInput {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
  status?: InventoryStatus;
  sort?: InventorySortField;
  order?: InventorySortDirection;
}

export class InventoryService {
  constructor(
    private readonly inventories: InventoryRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async getProductStock(productUuid: string): Promise<Inventory> {
    const inventory = await this.inventories.findByProductUuid(productUuid);

    if (!inventory) {
      throw new InventoryProductNotFoundError();
    }

    return inventory;
  }

  async listInventory(
    input: ListInventoryInput = {},
  ): Promise<InventoryListResult> {
    const search = input.search?.trim();

    return this.inventories.findMany({
      page: input.page ?? 1,
      limit: input.limit ?? 15,
      ...(search ? { search } : {}),
      ...(input.isActive === undefined ? {} : { isActive: input.isActive }),
      ...(input.status ? { status: input.status } : {}),
      sort: input.sort ?? "name",
      order: input.order ?? "asc",
      tieBreakers: inventoryListTieBreakers,
    });
  }

  async updateMinimumStock(
    productUuid: string,
    minimumStock: number,
  ): Promise<Inventory> {
    const inventory = await this.getProductStock(productUuid);
    const updatedInventory = updateMinimumStock(
      inventory,
      minimumStock,
      this.now(),
    );

    return this.inventories.updateMinimumStock(updatedInventory);
  }
}
