import {
  InsufficientStockError,
  InvalidStockAdjustmentQuantityError,
  InvalidStockMovementPreviousStockError,
  InvalidStockMovementQuantityError,
} from "./stock-movement.errors.js";

export type StockMovementType = "IN" | "OUT" | "ADJUSTMENT";

export interface StockMovement {
  uuid: string;
  productUuid: string;
  type: StockMovementType;
  quantity: number;
  previousStock: number;
  newStock: number;
  reason: string | null;
  reference: string | null;
  createdAt: Date;
}

interface CreateStockMovementData {
  uuid: string;
  productUuid: string;
  quantity: number;
  previousStock: number;
  reference: string | null;
  createdAt: Date;
}

export interface CreateStockAdjustmentData extends CreateStockMovementData {
  reason: string;
}

export function createStockEntry(data: CreateStockMovementData): StockMovement {
  const previousStock = validatePreviousStock(data.previousStock);
  const quantity = validatePositiveQuantity(data.quantity);

  return createMovement(data, "IN", quantity, previousStock + quantity, null);
}

export function createStockExit(data: CreateStockMovementData): StockMovement {
  const previousStock = validatePreviousStock(data.previousStock);
  const quantity = validatePositiveQuantity(data.quantity);

  if (quantity > previousStock) {
    throw new InsufficientStockError();
  }

  return createMovement(data, "OUT", quantity, previousStock - quantity, null);
}

export function createStockAdjustment(
  data: CreateStockAdjustmentData,
): StockMovement {
  validatePreviousStock(data.previousStock);
  const quantity = validateNonNegativeQuantity(data.quantity);

  return createMovement(data, "ADJUSTMENT", quantity, quantity, data.reason);
}

function createMovement(
  data: CreateStockMovementData,
  type: StockMovementType,
  quantity: number,
  newStock: number,
  reason: string | null,
): StockMovement {
  return {
    uuid: data.uuid,
    productUuid: data.productUuid,
    type,
    quantity,
    previousStock: data.previousStock,
    newStock,
    reason,
    reference: data.reference,
    createdAt: data.createdAt,
  };
}

function validatePositiveQuantity(quantity: number): number {
  if (!isNonNegativeInteger(quantity) || quantity === 0) {
    throw new InvalidStockMovementQuantityError();
  }

  return quantity;
}

function validateNonNegativeQuantity(quantity: number): number {
  if (!isNonNegativeInteger(quantity)) {
    throw new InvalidStockAdjustmentQuantityError();
  }

  return quantity;
}

function validatePreviousStock(previousStock: number): number {
  if (!isNonNegativeInteger(previousStock)) {
    throw new InvalidStockMovementPreviousStockError();
  }

  return previousStock;
}

function isNonNegativeInteger(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}
