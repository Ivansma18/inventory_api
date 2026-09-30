import type { MiddlewareHandler } from "hono";
import { createRoute, OpenAPIHono } from "@hono/zod-openapi";

import type {
  AdjustStockInput,
  CreateStockEntryInput,
  CreateStockExitInput,
} from "../application/stock-movement.service.js";
import type { StockMovement } from "../domain/stock-movement.entity.js";
import {
  InsufficientStockError,
  InvalidStockAdjustmentReasonError,
  StockMovementProductNotFoundError,
} from "../domain/stock-movement.errors.js";
import { errorHandler } from "../../../shared/errors/error-handler.js";
import type { AuthMiddlewareEnv } from "../../../shared/middlewares/auth.middleware.js";
import { createAuthorizationMiddleware } from "../../authorization/index.js";
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
  authMiddleware?: MiddlewareHandler<AuthMiddlewareEnv>;
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
  401: {
    content: {
      "application/json": { schema: stockMovementErrorResponseSchema },
    },
    description: "Authentication required",
  },
  403: {
    content: {
      "application/json": { schema: stockMovementErrorResponseSchema },
    },
    description: "Insufficient stock movement permissions",
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
  security: [{ sessionCookie: [] }],
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
  security: [{ sessionCookie: [] }],
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
  security: [{ sessionCookie: [] }],
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
  authMiddleware,
}: StockMovementCreationRoutesDependencies): OpenAPIHono<AuthMiddlewareEnv> {
  const routes = new OpenAPIHono<AuthMiddlewareEnv>({
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

  if (authMiddleware) {
    routes.use("*", async (context, next) => {
      if (context.req.method !== "POST") {
        return next();
      }

      return authMiddleware(context, next);
    });
    routes.use(
      "/:productUuid/entries",
      createAuthorizationMiddleware("stock-movement:entry"),
    );
    routes.use(
      "/:productUuid/exits",
      createAuthorizationMiddleware("stock-movement:exit"),
    );
    routes.use(
      "/:productUuid/adjustments",
      createAuthorizationMiddleware("stock-movement:adjust"),
    );
  }

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
    if (
      error instanceof InsufficientStockError ||
      error instanceof InvalidStockAdjustmentReasonError
    ) {
      return context.json(
        {
          error: {
            code:
              error instanceof InsufficientStockError
                ? "INSUFFICIENT_STOCK"
                : "VALIDATION_ERROR",
            message: error.message,
          },
        },
        error instanceof InsufficientStockError ? 409 : 400,
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
