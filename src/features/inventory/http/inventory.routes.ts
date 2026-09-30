import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import type { MiddlewareHandler } from "hono";

import type { ListInventoryInput } from "../application/inventory.service.js";
import type { Inventory } from "../domain/inventory.entity.js";
import { InventoryProductNotFoundError } from "../domain/inventory.errors.js";
import type { InventoryListResult } from "../domain/inventory.repository.js";
import { errorHandler } from "../../../shared/errors/error-handler.js";
import type { AuthMiddlewareEnv } from "../../../shared/middlewares/auth.middleware.js";
import { createAuthorizationMiddleware } from "../../authorization/index.js";
import {
  toInventoryListResponse,
  toInventoryResponse,
} from "./inventory.mapper.js";
import {
  inventoryDataResponseSchema,
  inventoryErrorResponseSchema,
  inventoryListQuerySchema,
  inventoryListResponseSchema,
  inventoryParamsSchema,
  updateMinimumStockSchema,
} from "./inventory.schemas.js";

export interface InventoryHttpService {
  getProductStock(productUuid: string): Promise<Inventory>;
  listInventory(input?: ListInventoryInput): Promise<InventoryListResult>;
  updateMinimumStock(
    productUuid: string,
    minimumStock: number,
  ): Promise<Inventory>;
}

interface InventoryRoutesDependencies {
  service: InventoryHttpService;
  authMiddleware?: MiddlewareHandler<AuthMiddlewareEnv>;
}

const listInventoryRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["Inventory"],
  request: { query: inventoryListQuerySchema },
  responses: {
    200: {
      content: { "application/json": { schema: inventoryListResponseSchema } },
      description: "Inventory retrieved",
    },
    400: {
      content: { "application/json": { schema: inventoryErrorResponseSchema } },
      description: "Invalid list query",
    },
  },
});

const getInventoryRoute = createRoute({
  method: "get",
  path: "/{productUuid}",
  tags: ["Inventory"],
  request: { params: inventoryParamsSchema },
  responses: {
    200: {
      content: { "application/json": { schema: inventoryDataResponseSchema } },
      description: "Inventory retrieved",
    },
    400: {
      content: { "application/json": { schema: inventoryErrorResponseSchema } },
      description: "Invalid product UUID",
    },
    404: {
      content: { "application/json": { schema: inventoryErrorResponseSchema } },
      description: "Product inventory not found",
    },
  },
});

const updateMinimumStockRoute = createRoute({
  method: "patch",
  path: "/{productUuid}/minimum-stock",
  tags: ["Inventory"],
  security: [{ sessionCookie: [] }],
  request: {
    params: inventoryParamsSchema,
    body: {
      content: {
        "application/json": { schema: updateMinimumStockSchema },
      },
      required: true,
    },
  },
  responses: {
    200: {
      content: { "application/json": { schema: inventoryDataResponseSchema } },
      description: "Minimum stock updated",
    },
    400: {
      content: { "application/json": { schema: inventoryErrorResponseSchema } },
      description: "Invalid product UUID or minimum stock",
    },
    401: {
      content: { "application/json": { schema: inventoryErrorResponseSchema } },
      description: "Authentication required",
    },
    403: {
      content: { "application/json": { schema: inventoryErrorResponseSchema } },
      description: "Insufficient inventory permissions",
    },
    404: {
      content: { "application/json": { schema: inventoryErrorResponseSchema } },
      description: "Product inventory not found",
    },
  },
});

export function createInventoryRoutes({
  service,
  authMiddleware,
}: InventoryRoutesDependencies): OpenAPIHono<AuthMiddlewareEnv> {
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
    routes.use("/:productUuid/minimum-stock", authMiddleware);
    routes.use(
      "/:productUuid/minimum-stock",
      createAuthorizationMiddleware("inventory:minimum-stock:update"),
    );
  }

  routes.openapi(listInventoryRoute, async (context) => {
    const input = context.req.valid("query");
    const result = await service.listInventory(input);

    return context.json(
      toInventoryListResponse(result, input.page ?? 1, input.limit ?? 15),
      200,
    );
  });
  routes.openapi(getInventoryRoute, async (context) => {
    const { productUuid } = context.req.valid("param");
    const inventory = await service.getProductStock(productUuid);

    return context.json({ data: toInventoryResponse(inventory) }, 200);
  });
  routes.openapi(updateMinimumStockRoute, async (context) => {
    const { productUuid } = context.req.valid("param");
    const { minimumStock } = context.req.valid("json");

    if (minimumStock === undefined) {
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

    const inventory = await service.updateMinimumStock(
      productUuid,
      minimumStock,
    );

    return context.json({ data: toInventoryResponse(inventory) }, 200);
  });
  routes.onError((error, context) => {
    if (error instanceof InventoryProductNotFoundError) {
      return context.json(
        {
          error: {
            code: "INVENTORY_PRODUCT_NOT_FOUND",
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
