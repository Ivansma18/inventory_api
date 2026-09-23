import { createRoute, OpenAPIHono } from "@hono/zod-openapi";

import type {
  CreateProductInput,
  ListProductsInput,
  UpdateProductInput,
} from "../application/product.service.js";
import type { Product } from "../domain/product.entity.js";
import type { ProductListResult } from "../domain/product.repository.js";
import {
  InvalidProductNameError,
  InvalidProductPriceError,
  InvalidProductSkuError,
  ProductNotFoundError,
  ProductSkuAlreadyExistsError,
} from "../domain/product.errors.js";
import { errorHandler } from "../../../shared/errors/error-handler.js";
import { toProductListResponse, toProductResponse } from "./product.mapper.js";
import {
  createProductSchema,
  errorResponseSchema,
  productDataResponseSchema,
  productListQuerySchema,
  productListResponseSchema,
  productParamsSchema,
  updateProductSchema,
} from "./product.schemas.js";

export interface ProductHttpService {
  createProduct(input: CreateProductInput): Promise<Product>;
  getProduct(uuid: string): Promise<Product>;
  listProducts(input?: ListProductsInput): Promise<ProductListResult>;
  updateProduct(uuid: string, input: UpdateProductInput): Promise<Product>;
}

interface ProductRoutesDependencies {
  service: ProductHttpService;
}

const createProductRoute = createRoute({
  method: "post",
  path: "/",
  tags: ["Products"],
  request: {
    body: {
      content: {
        "application/json": { schema: createProductSchema },
      },
      required: true,
    },
  },
  responses: {
    201: {
      content: { "application/json": { schema: productDataResponseSchema } },
      description: "Product created",
    },
    400: {
      content: { "application/json": { schema: errorResponseSchema } },
      description: "Invalid product data",
    },
    409: {
      content: { "application/json": { schema: errorResponseSchema } },
      description: "Product SKU already exists",
    },
  },
});

const getProductRoute = createRoute({
  method: "get",
  path: "/{uuid}",
  tags: ["Products"],
  request: { params: productParamsSchema },
  responses: {
    200: {
      content: { "application/json": { schema: productDataResponseSchema } },
      description: "Product retrieved",
    },
    400: {
      content: { "application/json": { schema: errorResponseSchema } },
      description: "Invalid product UUID",
    },
    404: {
      content: { "application/json": { schema: errorResponseSchema } },
      description: "Product not found",
    },
  },
});

const listProductsRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["Products"],
  request: { query: productListQuerySchema },
  responses: {
    200: {
      content: { "application/json": { schema: productListResponseSchema } },
      description: "Products retrieved",
    },
    400: {
      content: { "application/json": { schema: errorResponseSchema } },
      description: "Invalid list query",
    },
  },
});

const updateProductRoute = createRoute({
  method: "patch",
  path: "/{uuid}",
  tags: ["Products"],
  request: {
    params: productParamsSchema,
    body: {
      content: {
        "application/json": { schema: updateProductSchema },
      },
      required: true,
    },
  },
  responses: {
    200: {
      content: { "application/json": { schema: productDataResponseSchema } },
      description: "Product updated",
    },
    400: {
      content: { "application/json": { schema: errorResponseSchema } },
      description: "Invalid product data or UUID",
    },
    404: {
      content: { "application/json": { schema: errorResponseSchema } },
      description: "Product not found",
    },
    409: {
      content: { "application/json": { schema: errorResponseSchema } },
      description: "Product SKU already exists",
    },
  },
});

export function createProductRoutes({
  service,
}: ProductRoutesDependencies): OpenAPIHono {
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

  routes.openapi(createProductRoute, async (context) => {
    const product = await service.createProduct(context.req.valid("json"));

    return context.json({ data: toProductResponse(product) }, 201);
  });
  routes.openapi(getProductRoute, async (context) => {
    const { uuid } = context.req.valid("param");
    const product = await service.getProduct(uuid);

    return context.json({ data: toProductResponse(product) }, 200);
  });
  routes.openapi(listProductsRoute, async (context) => {
    const input = context.req.valid("query");
    const result = await service.listProducts(input);

    return context.json(
      toProductListResponse(result, input.page ?? 1, input.limit ?? 15),
      200,
    );
  });
  routes.openapi(updateProductRoute, async (context) => {
    const { uuid } = context.req.valid("param");
    const product = await service.updateProduct(
      uuid,
      context.req.valid("json"),
    );

    return context.json({ data: toProductResponse(product) }, 200);
  });
  routes.onError((error, context) => {
    if (error instanceof ProductNotFoundError) {
      return context.json(
        {
          error: { code: "PRODUCT_NOT_FOUND", message: error.message },
        },
        404,
      );
    }

    if (error instanceof ProductSkuAlreadyExistsError) {
      return context.json(
        {
          error: {
            code: "PRODUCT_SKU_ALREADY_EXISTS",
            message: error.message,
          },
        },
        409,
      );
    }

    if (
      error instanceof InvalidProductSkuError ||
      error instanceof InvalidProductNameError ||
      error instanceof InvalidProductPriceError
    ) {
      return context.json(
        {
          error: { code: "INVALID_PRODUCT_DATA", message: error.message },
        },
        400,
      );
    }

    return errorHandler(error, context);
  });

  return routes;
}
