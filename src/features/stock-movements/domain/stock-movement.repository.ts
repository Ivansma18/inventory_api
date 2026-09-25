import type {
  StockMovement,
  StockMovementType,
} from "./stock-movement.entity.js";

interface StockMovementWriteIntentBase {
  productUuid: string;
  quantity: number;
  reference: string | null;
}

export interface StockEntryIntent extends StockMovementWriteIntentBase {
  type: "IN";
}

export interface StockExitIntent extends StockMovementWriteIntentBase {
  type: "OUT";
}

export interface StockAdjustmentIntent extends StockMovementWriteIntentBase {
  type: "ADJUSTMENT";
  reason: string;
}

export type StockMovementWriteIntent =
  StockEntryIntent | StockExitIntent | StockAdjustmentIntent;

export type StockMovementTieBreakerField = "uuid";

export interface StockMovementTieBreaker {
  sort: StockMovementTieBreakerField;
  order: "asc";
}

export const stockMovementListTieBreakers: readonly StockMovementTieBreaker[] =
  [{ sort: "uuid", order: "asc" }];

export interface StockMovementListQuery {
  page: number;
  limit: number;
  type?: StockMovementType;
  from?: Date;
  to?: Date;
  productUuid?: string;
  reference?: string;
  sort: "createdAt";
  order: "desc";
  tieBreakers: readonly StockMovementTieBreaker[];
}

export interface StockMovementListResult {
  movements: StockMovement[];
  total: number;
}

export interface StockMovementRepository {
  registerAtomically(intent: StockMovementWriteIntent): Promise<StockMovement>;
  findMany(query: StockMovementListQuery): Promise<StockMovementListResult>;
}
