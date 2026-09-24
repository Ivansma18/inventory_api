import { z } from "@hono/zod-openapi";

import { productSortFields } from "../domain/product.repository.js";

const priceSchema = z
  .number()
  .finite()
  .min(0)
  .refine(
    (price) => Math.abs(price * 100 - Math.round(price * 100)) <= 1e-8,
    "Price must have at most two decimal places.",
  )
  .openapi({ example: 100.25 });

const nonBlankStringSchema = z.string().trim().min(1);

export const createProductSchema = z
  .object({
    sku: nonBlankStringSchema.openapi({ example: "DESK-001" }),
    name: nonBlankStringSchema.openapi({ example: "Standing desk" }),
    description: z.string().nullable().optional().openapi({
      example: "Electric height-adjustable desk",
    }),
    purchasePrice: priceSchema,
    salePrice: priceSchema,
    categoryUuid: z.string().uuid().openapi({
      example: "550e8400-e29b-41d4-a716-446655440000",
    }),
  })
  .strip()
  .openapi("CreateProduct");

export const updateProductSchema = z
  .object({
    sku: nonBlankStringSchema.optional().openapi({ example: "DESK-001" }),
    name: nonBlankStringSchema.optional().openapi({
      example: "Standing desk",
    }),
    description: z.string().nullable().optional().openapi({
      example: "Electric height-adjustable desk",
    }),
    purchasePrice: priceSchema.optional(),
    salePrice: priceSchema.optional(),
    categoryUuid: z
      .string()
      .uuid()
      .optional()
      .openapi({ example: "550e8400-e29b-41d4-a716-446655440000" }),
    isActive: z.boolean().optional().openapi({ example: true }),
  })
  .strip()
  .refine((product) => Object.keys(product).length > 0, {
    message: "At least one product field is required.",
  })
  .openapi("UpdateProduct");

export const productParamsSchema = z
  .object({
    uuid: z
      .string()
      .uuid()
      .openapi({
        param: { name: "uuid", in: "path" },
        example: "550e8400-e29b-41d4-a716-446655440000",
      }),
  })
  .openapi("ProductParams");

export const productListQuerySchema = z
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
    sort: z.enum(productSortFields).optional().openapi({ example: "name" }),
    order: z.enum(["asc", "desc"]).optional().openapi({ example: "asc" }),
  })
  .openapi("ProductListQuery");

export const productResponseSchema = z
  .object({
    uuid: z.string().uuid(),
    sku: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    purchasePrice: z.number(),
    salePrice: z.number(),
    categoryUuid: z.string().uuid().nullable(),
    isActive: z.boolean(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi("Product");

export const productDataResponseSchema = z
  .object({ data: productResponseSchema })
  .openapi("ProductDataResponse");

export const productListResponseSchema = z
  .object({
    data: z.array(productResponseSchema),
    pagination: z.object({
      total: z.number().int().min(0),
      page: z.number().int().min(1),
      limit: z.number().int().min(1).max(100),
    }),
  })
  .openapi("ProductListResponse");

export const errorResponseSchema = z
  .object({
    error: z.object({
      code: z.string(),
      message: z.string(),
    }),
  })
  .openapi("ErrorResponse");
