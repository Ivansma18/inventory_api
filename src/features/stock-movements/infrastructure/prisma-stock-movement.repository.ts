import { randomUUID } from "node:crypto";

import { Prisma, type PrismaClient } from "../../../generated/prisma/client.js";
import {
  createStockAdjustment,
  createStockEntry,
  createStockExit,
  type StockMovement,
} from "../domain/stock-movement.entity.js";
import {
  StockMovementInventoryNotFoundError,
  StockMovementProductNotFoundError,
} from "../domain/stock-movement.errors.js";
import type {
  StockMovementListResult,
  StockMovementRepository,
  StockMovementWriteIntent,
} from "../domain/stock-movement.repository.js";

export class PrismaStockMovementRepository implements StockMovementRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async registerAtomically(
    intent: StockMovementWriteIntent,
  ): Promise<StockMovement> {
    return this.runSerializableTransaction(async (transaction) => {
      const product = await transaction.product.findUnique({
        where: { uuid: intent.productUuid },
        select: { id: true },
      });

      if (!product) {
        throw new StockMovementProductNotFoundError();
      }

      const inventory = await transaction.inventory.findUnique({
        where: { productId: product.id },
        select: { uuid: true, quantity: true },
      });

      if (!inventory) {
        throw new StockMovementInventoryNotFoundError();
      }

      const movement = createMovement(intent, inventory.quantity);

      await transaction.inventory.update({
        where: { uuid: inventory.uuid },
        data: { quantity: movement.newStock },
      });
      await transaction.stockMovement.create({
        data: {
          uuid: movement.uuid,
          productId: product.id,
          type: movement.type,
          quantity: movement.quantity,
          previousStock: movement.previousStock,
          newStock: movement.newStock,
          reason: movement.reason,
          reference: movement.reference,
          createdAt: movement.createdAt,
        },
      });

      return movement;
    });
  }

  async findMany(): Promise<StockMovementListResult> {
    throw new Error("Stock movement listing is not implemented.");
  }

  private async runSerializableTransaction<T>(
    operation: (transaction: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.prisma.$transaction(operation, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        });
      } catch (error) {
        if (!isTransactionConflict(error) || attempt === 2) {
          throw error;
        }
      }
    }

    throw new Error("Serializable transaction retry limit was reached.");
  }
}

function isTransactionConflict(error: unknown): boolean {
  const source =
    error instanceof Error && "cause" in error ? error.cause : error;

  return (
    (source instanceof Prisma.PrismaClientKnownRequestError &&
      source.code === "P2034") ||
    (typeof source === "object" &&
      source !== null &&
      "sqlState" in source &&
      (source.sqlState === "40001" || source.sqlState === "40P01")) ||
    (typeof source === "object" &&
      source !== null &&
      "kind" in source &&
      source.kind === "TransactionWriteConflict") ||
    (source instanceof Error &&
      source.message === "TransactionWriteConflict") ||
    (typeof error === "object" &&
      error !== null &&
      "kind" in error &&
      error.kind === "TransactionWriteConflict") ||
    (error instanceof Error && error.message === "TransactionWriteConflict")
  );
}

function createMovement(
  intent: StockMovementWriteIntent,
  previousStock: number,
): StockMovement {
  const data = {
    uuid: randomUUID(),
    productUuid: intent.productUuid,
    quantity: intent.quantity,
    previousStock,
    reference: intent.reference,
    createdAt: new Date(),
  };

  if (intent.type === "IN") {
    return createStockEntry(data);
  }

  if (intent.type === "OUT") {
    return createStockExit(data);
  }

  return createStockAdjustment({ ...data, reason: intent.reason });
}
