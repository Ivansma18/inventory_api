import type { StockMovement } from "../domain/stock-movement.entity.js";

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
