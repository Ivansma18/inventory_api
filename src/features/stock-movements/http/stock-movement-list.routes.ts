import { createRoute, OpenAPIHono } from "@hono/zod-openapi";

import type {
  GlobalStockMovementListInput,
  StockMovementListInput,
} from "../application/stock-movement.service.js";
import { StockMovementProductNotFoundError } from "../domain/stock-movement.errors.js";
import type { StockMovementListResult } from "../domain/stock-movement.repository.js";
import { errorHandler } from "../../../shared/errors/error-handler.js";
import { toStockMovementListResponse } from "./stock-movement.mapper.js";
import {
  stockMovementErrorResponseSchema,
  stockMovementListQuerySchema,
  stockMovementListResponseSchema,
  stockMovementParamsSchema,
  stockMovementProductListQuerySchema,
} from "./stock-movement.schemas.js";

export interface StockMovementListingHttpService {
  listProductStockMovements(
    productUuid: string,
    input?: StockMovementListInput,
  ): Promise<StockMovementListResult>;
  listStockMovements(
    input?: GlobalStockMovementListInput,
  ): Promise<StockMovementListResult>;
}

interface StockMovementListingRoutesDependencies {
  service: StockMovementListingHttpService;
}

const stockMovementListResponses = {
  200: {
    content: {
      "application/json": { schema: stockMovementListResponseSchema },
    },
    description: "Stock movements retrieved",
  },
  400: {
    content: {
      "application/json": { schema: stockMovementErrorResponseSchema },
    },
    description: "Invalid product UUID or list query",
  },
  404: {
    content: {
      "application/json": { schema: stockMovementErrorResponseSchema },
    },
    description: "Product not found",
  },
  500: {
    content: {
      "application/json": { schema: stockMovementErrorResponseSchema },
    },
    description: "Unexpected stock movement listing failure",
  },
};

const listProductStockMovementsRoute = createRoute({
  method: "get",
  path: "/{productUuid}/movements",
  tags: ["Stock Movements"],
  request: {
    params: stockMovementParamsSchema,
    query: stockMovementProductListQuerySchema,
  },
  responses: stockMovementListResponses,
});

const listStockMovementsRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["Stock Movements"],
  request: { query: stockMovementListQuerySchema },
  responses: stockMovementListResponses,
});

export function createStockMovementInventoryListRoutes({
  service,
}: StockMovementListingRoutesDependencies): OpenAPIHono {
  const routes = createRoutes();

  routes.openapi(listProductStockMovementsRoute, async (context) => {
    const { productUuid } = context.req.valid("param");
    const input = context.req.valid("query");
    const result = await service.listProductStockMovements(productUuid, input);

    return context.json(
      toStockMovementListResponse(result, input.page ?? 1, input.limit ?? 15),
      200,
    );
  });

  return routes;
}

export function createStockMovementListRoutes({
  service,
}: StockMovementListingRoutesDependencies): OpenAPIHono {
  const routes = createRoutes();

  routes.openapi(listStockMovementsRoute, async (context) => {
    const input = context.req.valid("query");
    const result = await service.listStockMovements(input);

    return context.json(
      toStockMovementListResponse(result, input.page ?? 1, input.limit ?? 15),
      200,
    );
  });

  return routes;
}

function createRoutes(): OpenAPIHono {
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

  routes.onError((error, context) => {
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
