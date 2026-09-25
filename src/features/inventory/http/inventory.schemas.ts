import { z } from "@hono/zod-openapi";

import { inventorySortFields } from "../domain/inventory.repository.js";

const inventoryStatusSchema = z.enum(["IN_STOCK", "LOW_STOCK", "OUT_OF_STOCK"]);
const nonNegativeIntegerSchema = z.number().finite().int().min(0);

export const inventoryParamsSchema = z
  .object({
    productUuid: z
      .string()
      .uuid()
      .openapi({
        param: { name: "productUuid", in: "path" },
        example: "550e8400-e29b-41d4-a716-446655440000",
      }),
  })
  .openapi("InventoryParams");

export const inventoryListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).optional().openapi({ example: 1 }),
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(100)
      .optional()
      .openapi({ example: 15 }),
    search: z.string().optional().openapi({ example: "desk" }),
    isActive: z
      .enum(["true", "false"])
      .optional()
      .transform((value) =>
        value === undefined ? undefined : value === "true",
      )
      .openapi({ example: "true" }),
    status: inventoryStatusSchema.optional().openapi({ example: "LOW_STOCK" }),
    sort: z.enum(inventorySortFields).optional().openapi({ example: "name" }),
    order: z.enum(["asc", "desc"]).optional().openapi({ example: "asc" }),
  })
  .openapi("InventoryListQuery");

export const updateMinimumStockSchema = z
  .object({
    minimumStock: nonNegativeIntegerSchema.optional().openapi({ example: 10 }),
  })
  .strip()
  .refine((inventory) => Object.keys(inventory).length > 0, {
    message: "Minimum stock is required.",
  })
  .openapi("UpdateInventoryMinimumStock");

export const inventoryResponseSchema = z
  .object({
    productUuid: z.string().uuid(),
    sku: z.string(),
    name: z.string(),
    categoryUuid: z.string().uuid().nullable(),
    isActive: z.boolean(),
    quantity: nonNegativeIntegerSchema,
    minimumStock: nonNegativeIntegerSchema,
    status: inventoryStatusSchema,
    updatedAt: z.string().datetime(),
  })
  .openapi("Inventory");

export const inventoryDataResponseSchema = z
  .object({ data: inventoryResponseSchema })
  .openapi("InventoryDataResponse");

export const inventoryListResponseSchema = z
  .object({
    data: z.array(inventoryResponseSchema),
    pagination: z.object({
      total: z.number().int().min(0),
      page: z.number().int().min(1),
      limit: z.number().int().min(1).max(100),
    }),
  })
  .openapi("InventoryListResponse");

export const inventoryErrorResponseSchema = z
  .object({
    error: z.object({
      code: z.string(),
      message: z.string(),
    }),
  })
  .openapi("InventoryErrorResponse");
