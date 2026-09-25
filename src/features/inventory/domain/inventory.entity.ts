import {
  InvalidInventoryMinimumStockError,
  InvalidInventoryQuantityError,
} from "./inventory.errors.js";

export type InventoryStatus = "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";

export interface Inventory {
  uuid: string;
  productUuid: string;
  sku: string;
  name: string;
  categoryUuid: string | null;
  isActive: boolean;
  quantity: number;
  minimumStock: number;
  updatedAt: Date;
}

export interface CreateInventoryData {
  uuid: string;
  productUuid: string;
  sku: string;
  name: string;
  categoryUuid: string | null;
  isActive: boolean;
  quantity: number;
  minimumStock: number;
  updatedAt: Date;
}

export function createInventory(data: CreateInventoryData): Inventory {
  return {
    uuid: data.uuid,
    productUuid: data.productUuid,
    sku: data.sku,
    name: data.name,
    categoryUuid: data.categoryUuid,
    isActive: data.isActive,
    quantity: validateQuantity(data.quantity),
    minimumStock: validateMinimumStock(data.minimumStock),
    updatedAt: data.updatedAt,
  };
}

export function updateMinimumStock(
  inventory: Inventory,
  minimumStock: number,
  updatedAt: Date,
): Inventory {
  return {
    ...inventory,
    minimumStock: validateMinimumStock(minimumStock),
    updatedAt,
  };
}

export function getInventoryStatus(inventory: Inventory): InventoryStatus {
  if (inventory.quantity === 0) {
    return "OUT_OF_STOCK";
  }

  if (inventory.quantity <= inventory.minimumStock) {
    return "LOW_STOCK";
  }

  return "IN_STOCK";
}

function validateQuantity(quantity: number): number {
  if (!isNonNegativeInteger(quantity)) {
    throw new InvalidInventoryQuantityError();
  }

  return quantity;
}

function validateMinimumStock(minimumStock: number): number {
  if (!isNonNegativeInteger(minimumStock)) {
    throw new InvalidInventoryMinimumStockError();
  }

  return minimumStock;
}

function isNonNegativeInteger(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}
