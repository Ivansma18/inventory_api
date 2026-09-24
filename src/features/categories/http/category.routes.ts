import { createRoute, OpenAPIHono } from "@hono/zod-openapi";

import type {
  CreateCategoryInput,
  ListCategoriesInput,
  UpdateCategoryInput,
} from "../application/category.service.js";
import type { Category } from "../domain/category.entity.js";
import type { CategoryListResult } from "../domain/category.repository.js";
import {
  CategoryHasAssociatedProductsError,
  CategoryInactiveError,
  CategoryNameAlreadyExistsError,
  CategoryNotFoundError,
  InvalidCategoryNameError,
} from "../domain/category.errors.js";
import { errorHandler } from "../../../shared/errors/error-handler.js";
import {
  toCategoryListResponse,
  toCategoryResponse,
} from "./category.mapper.js";
import {
  categoryDataResponseSchema,
  categoryErrorResponseSchema,
  categoryListQuerySchema,
  categoryListResponseSchema,
  categoryParamsSchema,
  createCategorySchema,
  deletedCategoryDataResponseSchema,
  updateCategorySchema,
} from "./category.schemas.js";

export interface CategoryHttpService {
  createCategory(input: CreateCategoryInput): Promise<Category>;
  getCategory(uuid: string): Promise<Category>;
  listCategories(input?: ListCategoriesInput): Promise<CategoryListResult>;
  updateCategory(uuid: string, input: UpdateCategoryInput): Promise<Category>;
  deleteCategory(uuid: string): Promise<{ uuid: string }>;
}

interface CategoryRoutesDependencies {
  service: CategoryHttpService;
}

const createCategoryRoute = createRoute({
  method: "post",
  path: "/",
  tags: ["Categories"],
  request: {
    body: {
      content: {
        "application/json": { schema: createCategorySchema },
      },
      required: true,
    },
  },
  responses: {
    201: {
      content: { "application/json": { schema: categoryDataResponseSchema } },
      description: "Category created",
    },
    400: {
      content: { "application/json": { schema: categoryErrorResponseSchema } },
      description: "Invalid category data",
    },
    409: {
      content: { "application/json": { schema: categoryErrorResponseSchema } },
      description: "Category name already exists",
    },
  },
});

const getCategoryRoute = createRoute({
  method: "get",
  path: "/{uuid}",
  tags: ["Categories"],
  request: { params: categoryParamsSchema },
  responses: {
    200: {
      content: { "application/json": { schema: categoryDataResponseSchema } },
      description: "Category retrieved",
    },
    400: {
      content: { "application/json": { schema: categoryErrorResponseSchema } },
      description: "Invalid category UUID",
    },
    404: {
      content: { "application/json": { schema: categoryErrorResponseSchema } },
      description: "Category not found",
    },
  },
});

const listCategoriesRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["Categories"],
  request: { query: categoryListQuerySchema },
  responses: {
    200: {
      content: { "application/json": { schema: categoryListResponseSchema } },
      description: "Categories retrieved",
    },
    400: {
      content: { "application/json": { schema: categoryErrorResponseSchema } },
      description: "Invalid list query",
    },
  },
});

const updateCategoryRoute = createRoute({
  method: "patch",
  path: "/{uuid}",
  tags: ["Categories"],
  request: {
    params: categoryParamsSchema,
    body: {
      content: {
        "application/json": { schema: updateCategorySchema },
      },
      required: true,
    },
  },
  responses: {
    200: {
      content: { "application/json": { schema: categoryDataResponseSchema } },
      description: "Category updated",
    },
    400: {
      content: { "application/json": { schema: categoryErrorResponseSchema } },
      description: "Invalid category data or UUID",
    },
    404: {
      content: { "application/json": { schema: categoryErrorResponseSchema } },
      description: "Category not found",
    },
    409: {
      content: { "application/json": { schema: categoryErrorResponseSchema } },
      description: "Category name already exists or category is in use",
    },
  },
});

const deleteCategoryRoute = createRoute({
  method: "delete",
  path: "/{uuid}",
  tags: ["Categories"],
  request: { params: categoryParamsSchema },
  responses: {
    200: {
      content: {
        "application/json": { schema: deletedCategoryDataResponseSchema },
      },
      description: "Category deleted",
    },
    400: {
      content: { "application/json": { schema: categoryErrorResponseSchema } },
      description: "Invalid category UUID",
    },
    404: {
      content: { "application/json": { schema: categoryErrorResponseSchema } },
      description: "Category not found",
    },
    409: {
      content: { "application/json": { schema: categoryErrorResponseSchema } },
      description: "Category has associated products",
    },
  },
});

export function createCategoryRoutes({
  service,
}: CategoryRoutesDependencies): OpenAPIHono {
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

  routes.openapi(createCategoryRoute, async (context) => {
    const category = await service.createCategory(context.req.valid("json"));

    return context.json({ data: toCategoryResponse(category) }, 201);
  });
  routes.openapi(getCategoryRoute, async (context) => {
    const { uuid } = context.req.valid("param");
    const category = await service.getCategory(uuid);

    return context.json({ data: toCategoryResponse(category) }, 200);
  });
  routes.openapi(listCategoriesRoute, async (context) => {
    const input = context.req.valid("query");
    const result = await service.listCategories(input);

    return context.json(
      toCategoryListResponse(result, input.page ?? 1, input.limit ?? 15),
      200,
    );
  });
  routes.openapi(updateCategoryRoute, async (context) => {
    const { uuid } = context.req.valid("param");
    const category = await service.updateCategory(
      uuid,
      context.req.valid("json"),
    );

    return context.json({ data: toCategoryResponse(category) }, 200);
  });
  routes.openapi(deleteCategoryRoute, async (context) => {
    const { uuid } = context.req.valid("param");
    const deletedCategory = await service.deleteCategory(uuid);

    return context.json({ data: deletedCategory }, 200);
  });
  routes.onError((error, context) => {
    if (error instanceof CategoryNotFoundError) {
      return context.json(
        { error: { code: "CATEGORY_NOT_FOUND", message: error.message } },
        404,
      );
    }

    if (error instanceof CategoryNameAlreadyExistsError) {
      return context.json(
        {
          error: {
            code: "CATEGORY_NAME_ALREADY_EXISTS",
            message: error.message,
          },
        },
        409,
      );
    }

    if (error instanceof CategoryHasAssociatedProductsError) {
      return context.json(
        {
          error: {
            code: "CATEGORY_HAS_ASSOCIATED_PRODUCTS",
            message: error.message,
          },
        },
        409,
      );
    }

    if (error instanceof CategoryInactiveError) {
      return context.json(
        { error: { code: "CATEGORY_INACTIVE", message: error.message } },
        409,
      );
    }

    if (error instanceof InvalidCategoryNameError) {
      return context.json(
        { error: { code: "INVALID_CATEGORY_DATA", message: error.message } },
        400,
      );
    }

    return errorHandler(error, context);
  });

  return routes;
}
