import { z } from "@hono/zod-openapi";

import { categorySortFields } from "../domain/category.repository.js";

const nonBlankStringSchema = z.string().trim().min(1);

export const createCategorySchema = z
  .object({
    name: nonBlankStringSchema.openapi({ example: "Office furniture" }),
    description: z.string().nullable().optional().openapi({
      example: "Desks, chairs, and storage",
    }),
  })
  .strip()
  .openapi("CreateCategory");

export const updateCategorySchema = z
  .object({
    name: nonBlankStringSchema.optional().openapi({
      example: "Office furniture",
    }),
    description: z.string().nullable().optional().openapi({
      example: "Desks, chairs, and storage",
    }),
    isActive: z.boolean().optional().openapi({ example: true }),
  })
  .strip()
  .refine((category) => Object.keys(category).length > 0, {
    message: "At least one category field is required.",
  })
  .openapi("UpdateCategory");

export const categoryParamsSchema = z
  .object({
    uuid: z
      .string()
      .uuid()
      .openapi({
        param: { name: "uuid", in: "path" },
        example: "550e8400-e29b-41d4-a716-446655440000",
      }),
  })
  .openapi("CategoryParams");

export const categoryListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).optional().openapi({ example: 1 }),
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(100)
      .optional()
      .openapi({ example: 15 }),
    search: z.string().optional().openapi({ example: "furniture" }),
    isActive: z
      .enum(["true", "false"])
      .optional()
      .transform((value) =>
        value === undefined ? undefined : value === "true",
      )
      .openapi({ example: "true" }),
    sort: z.enum(categorySortFields).optional().openapi({ example: "name" }),
    order: z.enum(["asc", "desc"]).optional().openapi({ example: "asc" }),
  })
  .openapi("CategoryListQuery");

export const categoryResponseSchema = z
  .object({
    uuid: z.string().uuid(),
    name: z.string(),
    description: z.string().nullable(),
    isActive: z.boolean(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi("Category");

export const categoryDataResponseSchema = z
  .object({ data: categoryResponseSchema })
  .openapi("CategoryDataResponse");

export const categoryListResponseSchema = z
  .object({
    data: z.array(categoryResponseSchema),
    pagination: z.object({
      total: z.number().int().min(0),
      page: z.number().int().min(1),
      limit: z.number().int().min(1).max(100),
    }),
  })
  .openapi("CategoryListResponse");

export const deletedCategoryDataResponseSchema = z
  .object({ data: z.object({ uuid: z.string().uuid() }) })
  .openapi("DeletedCategoryDataResponse");

export const categoryErrorResponseSchema = z
  .object({
    error: z.object({
      code: z.string(),
      message: z.string(),
    }),
  })
  .openapi("CategoryErrorResponse");
