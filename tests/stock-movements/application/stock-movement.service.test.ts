import { describe, expect, it } from "vitest";

import { StockMovementService } from "../../../src/features/stock-movements/application/stock-movement.service.js";
import type { StockMovement } from "../../../src/features/stock-movements/domain/stock-movement.entity.js";
import type {
  StockMovementListQuery,
  StockMovementListResult,
  StockMovementRepository,
  StockMovementWriteIntent,
} from "../../../src/features/stock-movements/domain/stock-movement.repository.js";

const productUuid = "550e8400-e29b-41d4-a716-446655440000";

class FakeStockMovementRepository implements StockMovementRepository {
  readonly registeredIntents: StockMovementWriteIntent[] = [];
  lastListQuery: StockMovementListQuery | undefined;

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

  async findMany(
    query: StockMovementListQuery,
  ): Promise<StockMovementListResult> {
    this.lastListQuery = query;

    return { movements: [], total: 0 };
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

  it("uses defaults and product scope for product movement listings", async () => {
    const { repository, service } = createService();

    await expect(
      service.listProductStockMovements(productUuid),
    ).resolves.toEqual({ movements: [], total: 0 });
    expect(repository.lastListQuery).toEqual({
      page: 1,
      limit: 15,
      productUuid,
      sort: "createdAt",
      order: "desc",
      tieBreakers: [{ sort: "uuid", order: "asc" }],
    });
  });

  it("passes global filters and the supported maximum limit to the repository", async () => {
    const { repository, service } = createService();
    const from = new Date("2026-09-01T00:00:00.000Z");
    const to = new Date("2026-09-30T23:59:59.999Z");

    await service.listStockMovements({
      page: 2,
      limit: 100,
      type: "ADJUSTMENT",
      from,
      to,
      productUuid,
      reference: "  count-001  ",
    });

    expect(repository.lastListQuery).toEqual({
      page: 2,
      limit: 100,
      type: "ADJUSTMENT",
      from,
      to,
      productUuid,
      reference: "count-001",
      sort: "createdAt",
      order: "desc",
      tieBreakers: [{ sort: "uuid", order: "asc" }],
    });
  });

  it("omits empty reference filters", async () => {
    const { repository, service } = createService();

    await service.listStockMovements({ reference: "   " });

    expect(repository.lastListQuery).not.toHaveProperty("reference");
  });
});
