import {
  getInventoryStatus,
  type Inventory,
} from "../domain/inventory.entity.js";
import type { InventoryListResult } from "../domain/inventory.repository.js";

export interface InventoryResponse {
  productUuid: string;
  sku: string;
  name: string;
  categoryUuid: string | null;
  isActive: boolean;
  quantity: number;
  minimumStock: number;
  status: "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";
  updatedAt: string;
}

export interface InventoryListResponse {
  data: InventoryResponse[];
  pagination: {
    total: number;
    page: number;
    limit: number;
  };
}

export function toInventoryResponse(inventory: Inventory): InventoryResponse {
  return {
    productUuid: inventory.productUuid,
    sku: inventory.sku,
    name: inventory.name,
    categoryUuid: inventory.categoryUuid,
    isActive: inventory.isActive,
    quantity: inventory.quantity,
    minimumStock: inventory.minimumStock,
    status: getInventoryStatus(inventory),
    updatedAt: inventory.updatedAt.toISOString(),
  };
}

export function toInventoryListResponse(
  result: InventoryListResult,
  page: number,
  limit: number,
): InventoryListResponse {
  return {
    data: result.inventories.map(toInventoryResponse),
    pagination: { total: result.total, page, limit },
  };
}
