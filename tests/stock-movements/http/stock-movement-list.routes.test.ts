import { describe, expect, it } from "vitest";

import type {
  GlobalStockMovementListInput,
  StockMovementListInput,
} from "../../../src/features/stock-movements/application/stock-movement.service.js";
import type { StockMovement } from "../../../src/features/stock-movements/domain/stock-movement.entity.js";
import { StockMovementProductNotFoundError } from "../../../src/features/stock-movements/domain/stock-movement.errors.js";
import {
  createStockMovementInventoryListRoutes,
  createStockMovementListRoutes,
  type StockMovementListingHttpService,
} from "../../../src/features/stock-movements/http/stock-movement-list.routes.js";

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
  overrides: Partial<StockMovementListingHttpService> = {},
): StockMovementListingHttpService {
  return {
    listProductStockMovements: async () => ({
      movements: [movement],
      total: 1,
    }),
    listStockMovements: async () => ({ movements: [movement], total: 1 }),
    ...overrides,
  };
}

describe("Stock movement listing routes", () => {
  it("lists a product history with validated filters and pagination", async () => {
    let receivedProductUuid: string | undefined;
    let receivedInput: StockMovementListInput | undefined;
    const app = createStockMovementInventoryListRoutes({
      service: createService({
        listProductStockMovements: async (uuid, input) => {
          receivedProductUuid = uuid;
          receivedInput = input;
          return { movements: [movement], total: 3 };
        },
      }),
    });

    const response = await app.request(
      `/${productUuid}/movements?page=2&limit=25&type=IN&from=2026-09-01T00%3A00%3A00.000Z&to=2026-09-30T23%3A59%3A59.999Z&reference=%20PURCHASE-001%20`,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: [{ ...movement, createdAt: "2026-09-25T10:00:00.000Z" }],
      pagination: { total: 3, page: 2, limit: 25 },
    });
    expect(receivedProductUuid).toBe(productUuid);
    expect(receivedInput).toEqual({
      page: 2,
      limit: 25,
      type: "IN",
      from: new Date("2026-09-01T00:00:00.000Z"),
      to: new Date("2026-09-30T23:59:59.999Z"),
      reference: " PURCHASE-001 ",
    });
  });

  it("lists global movements with optional product filtering and defaults", async () => {
    const receivedInputs: GlobalStockMovementListInput[] = [];
    const app = createStockMovementListRoutes({
      service: createService({
        listStockMovements: async (input) => {
          receivedInputs.push(input ?? {});
          return { movements: [], total: 0 };
        },
      }),
    });

    const filtered = await app.request(`/?productUuid=${productUuid}&type=OUT`);
    const defaults = await app.request("/");

    expect(filtered.status).toBe(200);
    await expect(filtered.json()).resolves.toEqual({
      data: [],
      pagination: { total: 0, page: 1, limit: 15 },
    });
    expect(defaults.status).toBe(200);
    expect(receivedInputs).toEqual([{ productUuid, type: "OUT" }, {}]);
  });

  it("rejects invalid list params and maps missing products to 404", async () => {
    const app = createStockMovementInventoryListRoutes({
      service: createService({
        listProductStockMovements: async () => {
          throw new StockMovementProductNotFoundError();
        },
      }),
    });

    const [invalidUuid, invalidLimit, invalidRange, missing] =
      await Promise.all([
        app.request("/not-a-uuid/movements"),
        app.request(`/${productUuid}/movements?limit=101`),
        app.request(
          `/${productUuid}/movements?from=2026-09-02T00%3A00%3A00.000Z&to=2026-09-01T00%3A00%3A00.000Z`,
        ),
        app.request(`/${productUuid}/movements`),
      ]);

    for (const response of [invalidUuid, invalidLimit, invalidRange]) {
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        error: {
          code: "VALIDATION_ERROR",
          message: "Request validation failed.",
        },
      });
    }
    expect(missing.status).toBe(404);
    await expect(missing.json()).resolves.toEqual({
      error: {
        code: "STOCK_MOVEMENT_PRODUCT_NOT_FOUND",
        message: "Stock movement product was not found.",
      },
    });
  });
});
