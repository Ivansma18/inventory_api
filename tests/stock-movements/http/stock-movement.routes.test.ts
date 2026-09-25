import { describe, expect, it } from "vitest";

import type {
  AdjustStockInput,
  CreateStockEntryInput,
  CreateStockExitInput,
} from "../../../src/features/stock-movements/application/stock-movement.service.js";
import type { StockMovement } from "../../../src/features/stock-movements/domain/stock-movement.entity.js";
import {
  InsufficientStockError,
  StockMovementInventoryNotFoundError,
  StockMovementProductNotFoundError,
} from "../../../src/features/stock-movements/domain/stock-movement.errors.js";
import {
  createStockMovementInventoryRoutes,
  type StockMovementCreationHttpService,
} from "../../../src/features/stock-movements/http/stock-movement.routes.js";

const productUuid = "550e8400-e29b-41d4-a716-446655440000";
const movement: StockMovement = {
  uuid: "550e8400-e29b-41d4-a716-446655440001",
  productUuid,
  type: "IN",
  quantity: 2,
  previousStock: 5,
  newStock: 7,
  reason: null,
  reference: "PURCHASE-001",
  createdAt: new Date("2026-09-25T10:00:00.000Z"),
};

function createService(
  overrides: Partial<StockMovementCreationHttpService> = {},
): StockMovementCreationHttpService {
  return {
    createStockEntry: async () => movement,
    createStockExit: async () => ({ ...movement, type: "OUT", newStock: 3 }),
    adjustStock: async () => ({
      ...movement,
      type: "ADJUSTMENT",
      quantity: 10,
      newStock: 10,
      reason: "Inventory count",
    }),
    ...overrides,
  };
}

function jsonRequest(body: unknown): RequestInit {
  return {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

describe("Stock movement creation routes", () => {
  it("creates entries and strips fields not recognized by the entry contract", async () => {
    let receivedProductUuid: string | undefined;
    let receivedInput: CreateStockEntryInput | undefined;
    const app = createStockMovementInventoryRoutes({
      service: createService({
        createStockEntry: async (uuid, input) => {
          receivedProductUuid = uuid;
          receivedInput = input;
          return movement;
        },
      }),
    });

    const response = await app.request(
      `/${productUuid}/entries`,
      jsonRequest({
        quantity: 2,
        reference: "PURCHASE-001",
        reason: "ignored",
        unexpected: true,
      }),
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      data: {
        ...movement,
        createdAt: "2026-09-25T10:00:00.000Z",
      },
    });
    expect(receivedProductUuid).toBe(productUuid);
    expect(receivedInput).toEqual({ quantity: 2, reference: "PURCHASE-001" });
  });

  it("creates exits and adjustments using their respective service inputs", async () => {
    let exitInput: CreateStockExitInput | undefined;
    let adjustmentInput: AdjustStockInput | undefined;
    const app = createStockMovementInventoryRoutes({
      service: createService({
        createStockExit: async (_, input) => {
          exitInput = input;
          return { ...movement, type: "OUT", newStock: 3, reference: null };
        },
        adjustStock: async (_, input) => {
          adjustmentInput = input;
          return {
            ...movement,
            type: "ADJUSTMENT",
            quantity: 10,
            newStock: 10,
            reason: "Inventory count",
          };
        },
      }),
    });

    const [exit, adjustment] = await Promise.all([
      app.request(`/${productUuid}/exits`, jsonRequest({ quantity: 2 })),
      app.request(
        `/${productUuid}/adjustments`,
        jsonRequest({
          quantity: 10,
          reason: "  Inventory count  ",
          reference: null,
          unexpected: true,
        }),
      ),
    ]);

    expect(exit.status).toBe(201);
    expect(adjustment.status).toBe(201);
    expect(exitInput).toEqual({ quantity: 2 });
    expect(adjustmentInput).toEqual({
      quantity: 10,
      reason: "Inventory count",
      reference: null,
    });
  });

  it("maps insufficient stock and unknown products to documented errors", async () => {
    const insufficientApp = createStockMovementInventoryRoutes({
      service: createService({
        createStockExit: async () => {
          throw new InsufficientStockError();
        },
      }),
    });
    const missingProductApp = createStockMovementInventoryRoutes({
      service: createService({
        createStockEntry: async () => {
          throw new StockMovementProductNotFoundError();
        },
      }),
    });

    const [insufficient, missingProduct] = await Promise.all([
      insufficientApp.request(
        `/${productUuid}/exits`,
        jsonRequest({ quantity: 10 }),
      ),
      missingProductApp.request(
        `/${productUuid}/entries`,
        jsonRequest({ quantity: 1 }),
      ),
    ]);

    expect(insufficient.status).toBe(409);
    await expect(insufficient.json()).resolves.toEqual({
      error: { code: "INSUFFICIENT_STOCK", message: "Insufficient stock." },
    });
    expect(missingProduct.status).toBe(404);
    await expect(missingProduct.json()).resolves.toEqual({
      error: {
        code: "STOCK_MOVEMENT_PRODUCT_NOT_FOUND",
        message: "Stock movement product was not found.",
      },
    });
  });

  it("returns validation errors for invalid params and bodies", async () => {
    const app = createStockMovementInventoryRoutes({
      service: createService(),
    });

    const [invalidUuid, invalidExit, invalidAdjustment] = await Promise.all([
      app.request("/not-a-uuid/entries", jsonRequest({ quantity: 1 })),
      app.request(`/${productUuid}/exits`, jsonRequest({ quantity: 0 })),
      app.request(
        `/${productUuid}/adjustments`,
        jsonRequest({ quantity: 1, reason: "   " }),
      ),
    ]);

    for (const response of [invalidUuid, invalidExit, invalidAdjustment]) {
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        error: {
          code: "VALIDATION_ERROR",
          message: "Request validation failed.",
        },
      });
    }
  });

  it("delegates technical and inventory consistency errors to the standard 500 response", async () => {
    const app = createStockMovementInventoryRoutes({
      service: createService({
        createStockEntry: async () => {
          throw new StockMovementInventoryNotFoundError();
        },
      }),
    });

    const response = await app.request(
      `/${productUuid}/entries`,
      jsonRequest({ quantity: 1 }),
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred.",
      },
    });
  });
});
