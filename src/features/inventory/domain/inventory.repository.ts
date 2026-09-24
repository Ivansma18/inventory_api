import type { Inventory, InventoryStatus } from "./inventory.entity.js";

export const inventorySortFields = [
  "name",
  "sku",
  "quantity",
  "minimumStock",
  "updatedAt",
] as const;

export type InventorySortField = (typeof inventorySortFields)[number];
export type InventorySortDirection = "asc" | "desc";
export type InventoryTieBreakerField = "sku" | "productUuid";

export interface InventoryTieBreaker {
  sort: InventoryTieBreakerField;
  order: "asc";
}

export const inventoryListTieBreakers: readonly InventoryTieBreaker[] = [
  { sort: "sku", order: "asc" },
  { sort: "productUuid", order: "asc" },
];

export interface InventoryListQuery {
  page: number;
  limit: number;
  search?: string;
  isActive?: boolean;
  status?: InventoryStatus;
  sort: InventorySortField;
  order: InventorySortDirection;
  tieBreakers: readonly InventoryTieBreaker[];
}

export interface InventoryListResult {
  inventories: Inventory[];
  total: number;
}

export interface InventoryRepository {
  findByProductUuid(productUuid: string): Promise<Inventory | null>;
  findMany(query: InventoryListQuery): Promise<InventoryListResult>;
  updateMinimumStock(inventory: Inventory): Promise<Inventory>;
}
