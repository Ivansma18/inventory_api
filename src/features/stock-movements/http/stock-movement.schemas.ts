import { z } from "@hono/zod-openapi";

const stockMovementTypeSchema = z.enum(["IN", "OUT", "ADJUSTMENT"]);
const positiveIntegerSchema = z.number().finite().int().positive();
const nonNegativeIntegerSchema = z.number().finite().int().min(0);
const referenceSchema = z.string().nullable().optional();
const isoDateTimeSchema = z
  .string()
  .datetime({ offset: true })
  .transform((value) => new Date(value));

const stockMovementListQueryFields = {
  page: z.coerce.number().int().min(1).optional().openapi({ example: 1 }),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .openapi({ example: 15 }),
  type: stockMovementTypeSchema.optional().openapi({ example: "IN" }),
  from: isoDateTimeSchema.optional().openapi({
    example: "2026-09-01T00:00:00.000Z",
  }),
  to: isoDateTimeSchema.optional().openapi({
    example: "2026-09-30T23:59:59.999Z",
  }),
  reference: z.string().optional().openapi({ example: "PURCHASE-001" }),
};

export const stockMovementParamsSchema = z
  .object({
    productUuid: z
      .string()
      .uuid()
      .openapi({
        param: { name: "productUuid", in: "path" },
        example: "550e8400-e29b-41d4-a716-446655440000",
      }),
  })
  .openapi("StockMovementParams");

export const createStockEntrySchema = z
  .object({
    quantity: positiveIntegerSchema.openapi({ example: 5 }),
    reference: referenceSchema.openapi({ example: "PURCHASE-001" }),
  })
  .strip()
  .openapi("CreateStockEntry");

export const createStockExitSchema = z
  .object({
    quantity: positiveIntegerSchema.openapi({ example: 2 }),
    reference: referenceSchema.openapi({ example: "SALE-001" }),
  })
  .strip()
  .openapi("CreateStockExit");

export const adjustStockSchema = z
  .object({
    quantity: nonNegativeIntegerSchema.openapi({ example: 20 }),
    reason: z.string().trim().min(1).openapi({ example: "Inventory count" }),
    reference: referenceSchema.openapi({ example: "COUNT-001" }),
  })
  .strip()
  .openapi("AdjustStock");

export const stockMovementProductListQuerySchema = z
  .object(stockMovementListQueryFields)
  .superRefine(validateDateRange)
  .openapi("StockMovementProductListQuery");

export const stockMovementListQuerySchema = z
  .object({
    ...stockMovementListQueryFields,
    productUuid: z
      .string()
      .uuid()
      .optional()
      .openapi({ example: "550e8400-e29b-41d4-a716-446655440000" }),
  })
  .superRefine(validateDateRange)
  .openapi("StockMovementListQuery");

export const stockMovementResponseSchema = z
  .object({
    uuid: z.string().uuid(),
    productUuid: z.string().uuid(),
    type: stockMovementTypeSchema,
    quantity: nonNegativeIntegerSchema,
    previousStock: nonNegativeIntegerSchema,
    newStock: nonNegativeIntegerSchema,
    reason: z.string().nullable(),
    reference: z.string().nullable(),
    createdAt: z.string().datetime(),
  })
  .openapi("StockMovement");

export const stockMovementDataResponseSchema = z
  .object({ data: stockMovementResponseSchema })
  .openapi("StockMovementDataResponse");

export const stockMovementListResponseSchema = z
  .object({
    data: z.array(stockMovementResponseSchema),
    pagination: z.object({
      total: nonNegativeIntegerSchema,
      page: z.number().int().min(1),
      limit: z.number().int().min(1).max(100),
    }),
  })
  .openapi("StockMovementListResponse");

export const stockMovementErrorResponseSchema = z
  .object({
    error: z.object({
      code: z.string(),
      message: z.string(),
    }),
  })
  .openapi("StockMovementErrorResponse");

function validateDateRange(
  query: { from?: Date; to?: Date },
  context: z.RefinementCtx,
) {
  if (query.from && query.to && query.from > query.to) {
    context.addIssue({
      code: "custom",
      message: "from must be before or equal to to.",
      path: ["from"],
    });
  }
}
