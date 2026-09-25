import type { StockMovement } from "../domain/stock-movement.entity.js";
import type { StockMovementListResult } from "../domain/stock-movement.repository.js";

export interface StockMovementResponse {
  uuid: string;
  productUuid: string;
  type: "IN" | "OUT" | "ADJUSTMENT";
  quantity: number;
  previousStock: number;
  newStock: number;
  reason: string | null;
  reference: string | null;
  createdAt: string;
}

export interface StockMovementListResponse {
  data: StockMovementResponse[];
  pagination: {
    total: number;
    page: number;
    limit: number;
  };
}

export function toStockMovementResponse(
  movement: StockMovement,
): StockMovementResponse {
  return {
    uuid: movement.uuid,
    productUuid: movement.productUuid,
    type: movement.type,
    quantity: movement.quantity,
    previousStock: movement.previousStock,
    newStock: movement.newStock,
    reason: movement.reason,
    reference: movement.reference,
    createdAt: movement.createdAt.toISOString(),
  };
}

export function toStockMovementListResponse(
  result: StockMovementListResult,
  page: number,
  limit: number,
): StockMovementListResponse {
  return {
    data: result.movements.map(toStockMovementResponse),
    pagination: { total: result.total, page, limit },
  };
}
