import type { StockMovement } from "../domain/stock-movement.entity.js";
import type { StockMovementRepository } from "../domain/stock-movement.repository.js";

export interface CreateStockEntryInput {
  quantity: number;
  reference?: string | null;
}

export interface CreateStockExitInput {
  quantity: number;
  reference?: string | null;
}

export interface AdjustStockInput {
  quantity: number;
  reason: string;
  reference?: string | null;
}

export class StockMovementService {
  constructor(private readonly stockMovements: StockMovementRepository) {}

  async createStockEntry(
    productUuid: string,
    input: CreateStockEntryInput,
  ): Promise<StockMovement> {
    return this.stockMovements.registerAtomically({
      type: "IN",
      productUuid,
      quantity: input.quantity,
      reference: normalizeReference(input.reference),
    });
  }

  async createStockExit(
    productUuid: string,
    input: CreateStockExitInput,
  ): Promise<StockMovement> {
    return this.stockMovements.registerAtomically({
      type: "OUT",
      productUuid,
      quantity: input.quantity,
      reference: normalizeReference(input.reference),
    });
  }

  async adjustStock(
    productUuid: string,
    input: AdjustStockInput,
  ): Promise<StockMovement> {
    return this.stockMovements.registerAtomically({
      type: "ADJUSTMENT",
      productUuid,
      quantity: input.quantity,
      reason: input.reason.trim(),
      reference: normalizeReference(input.reference),
    });
  }
}

function normalizeReference(
  reference: string | null | undefined,
): string | null {
  const normalizedReference = reference?.trim();

  return normalizedReference || null;
}
