import type {
  StockMovement,
  StockMovementType,
} from "../domain/stock-movement.entity.js";
import {
  stockMovementListTieBreakers,
  type StockMovementListResult,
  type StockMovementRepository,
} from "../domain/stock-movement.repository.js";

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

export interface StockMovementListInput {
  page?: number;
  limit?: number;
  type?: StockMovementType;
  from?: Date;
  to?: Date;
  reference?: string;
}

export interface GlobalStockMovementListInput extends StockMovementListInput {
  productUuid?: string;
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

  async listProductStockMovements(
    productUuid: string,
    input: StockMovementListInput = {},
  ): Promise<StockMovementListResult> {
    return this.findMovements({ ...input, productUuid });
  }

  async listStockMovements(
    input: GlobalStockMovementListInput = {},
  ): Promise<StockMovementListResult> {
    return this.findMovements(input);
  }

  private findMovements(
    input: GlobalStockMovementListInput,
  ): Promise<StockMovementListResult> {
    const reference = normalizeReference(input.reference);

    return this.stockMovements.findMany({
      page: input.page ?? 1,
      limit: input.limit ?? 15,
      ...(input.type ? { type: input.type } : {}),
      ...(input.from ? { from: input.from } : {}),
      ...(input.to ? { to: input.to } : {}),
      ...(input.productUuid ? { productUuid: input.productUuid } : {}),
      ...(reference ? { reference } : {}),
      sort: "createdAt",
      order: "desc",
      tieBreakers: stockMovementListTieBreakers,
    });
  }
}

function normalizeReference(
  reference: string | null | undefined,
): string | null {
  const normalizedReference = reference?.trim();

  return normalizedReference || null;
}
