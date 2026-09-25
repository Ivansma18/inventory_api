import { describe, expect, it } from "vitest";

import { StockMovementService } from "../../../src/features/stock-movements/application/stock-movement.service.js";
import type { StockMovement } from "../../../src/features/stock-movements/domain/stock-movement.entity.js";
import type {
  StockMovementListResult,
  StockMovementRepository,
  StockMovementWriteIntent,
} from "../../../src/features/stock-movements/domain/stock-movement.repository.js";

const productUuid = "550e8400-e29b-41d4-a716-446655440000";

class FakeStockMovementRepository implements StockMovementRepository {
  readonly registeredIntents: StockMovementWriteIntent[] = [];

  async registerAtomically(
    intent: StockMovementWriteIntent,
  ): Promise<StockMovement> {
    this.registeredIntents.push(intent);

    return {
      uuid: `b1c7b78c-7f8d-4d4a-a01a-2e8d41dfb15${this.registeredIntents.length}`,
      productUuid: intent.productUuid,
      type: intent.type,
      quantity: intent.quantity,
      previousStock: 0,
      newStock: intent.quantity,
      reason: intent.type === "ADJUSTMENT" ? intent.reason : null,
      reference: intent.reference,
      createdAt: new Date("2026-09-25T10:00:00.000Z"),
    };
  }

  async findMany(): Promise<StockMovementListResult> {
    throw new Error("Listing is not part of this fake repository yet.");
  }
}

function createService() {
  const repository = new FakeStockMovementRepository();

  return { repository, service: new StockMovementService(repository) };
}

describe("StockMovementService", () => {
  it("registers entry and exit intents with normalized references", async () => {
    const { repository, service } = createService();

    await service.createStockEntry(productUuid, {
      quantity: 4,
      reference: "  PURCHASE-001  ",
    });
    await service.createStockExit(productUuid, {
      quantity: 2,
      reference: "   ",
    });

    expect(repository.registeredIntents).toEqual([
      {
        type: "IN",
        productUuid,
        quantity: 4,
        reference: "PURCHASE-001",
      },
      {
        type: "OUT",
        productUuid,
        quantity: 2,
        reference: null,
      },
    ]);
  });

  it("registers adjustments with a trimmed reason and null references", async () => {
    const { repository, service } = createService();

    await expect(
      service.adjustStock(productUuid, {
        quantity: 8,
        reason: "  Inventory count  ",
        reference: null,
      }),
    ).resolves.toMatchObject({
      type: "ADJUSTMENT",
      quantity: 8,
      reason: "Inventory count",
      reference: null,
    });
    expect(repository.registeredIntents).toEqual([
      {
        type: "ADJUSTMENT",
        productUuid,
        quantity: 8,
        reason: "Inventory count",
        reference: null,
      },
    ]);
  });

  it("allows movements for inactive products without a product-state lookup", async () => {
    const { repository, service } = createService();
    const inactiveProductUuid = "550e8400-e29b-41d4-a716-446655440001";

    await expect(
      service.createStockEntry(inactiveProductUuid, { quantity: 1 }),
    ).resolves.toMatchObject({ productUuid: inactiveProductUuid, type: "IN" });
    expect(repository.registeredIntents).toEqual([
      {
        type: "IN",
        productUuid: inactiveProductUuid,
        quantity: 1,
        reference: null,
      },
    ]);
  });

  it("registers repeated valid requests independently", async () => {
    const { repository, service } = createService();
    const input = { quantity: 3, reference: "  PURCHASE-002  " };

    const [first, second] = await Promise.all([
      service.createStockEntry(productUuid, input),
      service.createStockEntry(productUuid, input),
    ]);

    expect(repository.registeredIntents).toEqual([
      {
        type: "IN",
        productUuid,
        quantity: 3,
        reference: "PURCHASE-002",
      },
      {
        type: "IN",
        productUuid,
        quantity: 3,
        reference: "PURCHASE-002",
      },
    ]);
    expect(first.uuid).not.toEqual(second.uuid);
  });
});
