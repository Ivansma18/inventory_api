import { describe, expect, it } from "vitest";

import type { StockMovement } from "../../../src/features/stock-movements/domain/stock-movement.entity.js";
import {
  stockMovementListTieBreakers,
  type StockMovementListQuery,
  type StockMovementRepository,
  type StockMovementWriteIntent,
} from "../../../src/features/stock-movements/domain/stock-movement.repository.js";

const movement: StockMovement = {
  uuid: "b1c7b78c-7f8d-4d4a-a01a-2e8d41dfb15d",
  productUuid: "550e8400-e29b-41d4-a716-446655440000",
  type: "IN",
  quantity: 4,
  previousStock: 6,
  newStock: 10,
  reason: null,
  reference: null,
  createdAt: new Date("2026-09-25T10:00:00.000Z"),
};

describe("StockMovement repository contract", () => {
  it("defines write intents for entries, exits, and adjustments", () => {
    const intents: StockMovementWriteIntent[] = [
      {
        type: "IN",
        productUuid: movement.productUuid,
        quantity: 4,
        reference: null,
      },
      {
        type: "OUT",
        productUuid: movement.productUuid,
        quantity: 2,
        reference: "SALE-001",
      },
      {
        type: "ADJUSTMENT",
        productUuid: movement.productUuid,
        quantity: 8,
        reason: "Inventory count",
        reference: null,
      },
    ];

    expect(intents).toHaveLength(3);
    expect(intents.map(({ type }) => type)).toEqual([
      "IN",
      "OUT",
      "ADJUSTMENT",
    ]);
  });

  it("defines stable descending chronological ordering for paginated lists", () => {
    expect(stockMovementListTieBreakers).toEqual([
      { sort: "uuid", order: "asc" },
    ]);
  });

  it("accepts paginated list filters with the fixed chronological order", () => {
    const query: StockMovementListQuery = {
      page: 2,
      limit: 15,
      type: "ADJUSTMENT",
      from: new Date("2026-09-01T00:00:00.000Z"),
      to: new Date("2026-09-30T23:59:59.999Z"),
      productUuid: movement.productUuid,
      reference: "count",
      sort: "createdAt",
      order: "desc",
      tieBreakers: stockMovementListTieBreakers,
    };

    expect(query).toMatchObject({
      page: 2,
      limit: 15,
      type: "ADJUSTMENT",
      productUuid: movement.productUuid,
      reference: "count",
      sort: "createdAt",
      order: "desc",
    });
  });

  it("exposes only atomic registration and listing operations", () => {
    const repository: StockMovementRepository = {
      registerAtomically: async () => movement,
      findMany: async () => ({ movements: [], total: 0 }),
    };

    expect(repository).toHaveProperty("registerAtomically");
    expect(repository).toHaveProperty("findMany");
    expect(repository).not.toHaveProperty("update");
    expect(repository).not.toHaveProperty("delete");
  });
});
