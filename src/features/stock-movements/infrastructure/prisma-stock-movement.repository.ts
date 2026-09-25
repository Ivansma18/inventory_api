import { randomUUID } from "node:crypto";

import type { PrismaClient } from "../../../generated/prisma/client.js";
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
    return this.prisma.$transaction(async (transaction) => {
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
