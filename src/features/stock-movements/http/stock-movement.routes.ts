import { createRoute, OpenAPIHono } from "@hono/zod-openapi";

import type {
  AdjustStockInput,
  CreateStockEntryInput,
  CreateStockExitInput,
} from "../application/stock-movement.service.js";
import type { StockMovement } from "../domain/stock-movement.entity.js";
import {
  InsufficientStockError,
  StockMovementProductNotFoundError,
} from "../domain/stock-movement.errors.js";
import { errorHandler } from "../../../shared/errors/error-handler.js";
import { toStockMovementResponse } from "./stock-movement.mapper.js";
import {
  adjustStockSchema,
  createStockEntrySchema,
  createStockExitSchema,
  stockMovementDataResponseSchema,
  stockMovementErrorResponseSchema,
  stockMovementParamsSchema,
} from "./stock-movement.schemas.js";

export interface StockMovementCreationHttpService {
  createStockEntry(
    productUuid: string,
    input: CreateStockEntryInput,
  ): Promise<StockMovement>;
  createStockExit(
    productUuid: string,
    input: CreateStockExitInput,
  ): Promise<StockMovement>;
  adjustStock(
    productUuid: string,
    input: AdjustStockInput,
  ): Promise<StockMovement>;
}

interface StockMovementCreationRoutesDependencies {
  service: StockMovementCreationHttpService;
}

const stockMovementCreationResponses = {
  201: {
    content: {
      "application/json": { schema: stockMovementDataResponseSchema },
    },
    description: "Stock movement created",
  },
  400: {
    content: {
      "application/json": { schema: stockMovementErrorResponseSchema },
    },
    description: "Invalid product UUID or movement data",
  },
  404: {
    content: {
      "application/json": { schema: stockMovementErrorResponseSchema },
    },
    description: "Product not found",
  },
  409: {
    content: {
      "application/json": { schema: stockMovementErrorResponseSchema },
    },
    description: "Insufficient stock",
  },
  500: {
    content: {
      "application/json": { schema: stockMovementErrorResponseSchema },
    },
    description: "Unexpected stock movement failure",
  },
};

const createStockEntryRoute = createRoute({
  method: "post",
  path: "/{productUuid}/entries",
  tags: ["Stock Movements"],
  request: {
    params: stockMovementParamsSchema,
    body: {
      content: { "application/json": { schema: createStockEntrySchema } },
      required: true,
    },
  },
  responses: stockMovementCreationResponses,
});

const createStockExitRoute = createRoute({
  method: "post",
  path: "/{productUuid}/exits",
  tags: ["Stock Movements"],
  request: {
    params: stockMovementParamsSchema,
    body: {
      content: { "application/json": { schema: createStockExitSchema } },
      required: true,
    },
  },
  responses: stockMovementCreationResponses,
});

const adjustStockRoute = createRoute({
  method: "post",
  path: "/{productUuid}/adjustments",
  tags: ["Stock Movements"],
  request: {
    params: stockMovementParamsSchema,
    body: {
      content: { "application/json": { schema: adjustStockSchema } },
      required: true,
    },
  },
  responses: stockMovementCreationResponses,
});

export function createStockMovementInventoryRoutes({
  service,
}: StockMovementCreationRoutesDependencies): OpenAPIHono {
  const routes = new OpenAPIHono({
    defaultHook: (result, context) => {
      if (!result.success) {
        return context.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: "Request validation failed.",
            },
          },
          400,
        );
      }
    },
  });

  routes.openapi(createStockEntryRoute, async (context) => {
    const { productUuid } = context.req.valid("param");
    const movement = await service.createStockEntry(
      productUuid,
      context.req.valid("json"),
    );

    return context.json({ data: toStockMovementResponse(movement) }, 201);
  });
  routes.openapi(createStockExitRoute, async (context) => {
    const { productUuid } = context.req.valid("param");
    const movement = await service.createStockExit(
      productUuid,
      context.req.valid("json"),
    );

    return context.json({ data: toStockMovementResponse(movement) }, 201);
  });
  routes.openapi(adjustStockRoute, async (context) => {
    const { productUuid } = context.req.valid("param");
    const movement = await service.adjustStock(
      productUuid,
      context.req.valid("json"),
    );

    return context.json({ data: toStockMovementResponse(movement) }, 201);
  });
  routes.onError((error, context) => {
    if (error instanceof InsufficientStockError) {
      return context.json(
        {
          error: { code: "INSUFFICIENT_STOCK", message: error.message },
        },
        409,
      );
    }

    if (error instanceof StockMovementProductNotFoundError) {
      return context.json(
        {
          error: {
            code: "STOCK_MOVEMENT_PRODUCT_NOT_FOUND",
            message: error.message,
          },
        },
        404,
      );
    }

    return errorHandler(error, context);
  });

  return routes;
}
