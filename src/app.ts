import { swaggerUI } from "@hono/swagger-ui";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { cors } from "hono/cors";

import { createAuthRoutes } from "./features/auth/index.js";
import {
  createCategoryRoutes,
  type CategoryReader,
} from "./features/categories/index.js";
import { CategoryService } from "./features/categories/application/category.service.js";
import { PrismaCategoryRepository } from "./features/categories/infrastructure/prisma-category.repository.js";
import { createInventoryRoutes } from "./features/inventory/index.js";
import { InventoryService } from "./features/inventory/application/inventory.service.js";
import { PrismaInventoryRepository } from "./features/inventory/infrastructure/prisma-inventory.repository.js";
import { createProductRoutes } from "./features/products/index.js";
import { ProductService } from "./features/products/application/product.service.js";
import { PrismaProductRepository } from "./features/products/infrastructure/prisma-product.repository.js";
import {
  createStockMovementInventoryListRoutes,
  createStockMovementInventoryRoutes,
  createStockMovementListRoutes,
} from "./features/stock-movements/index.js";
import { StockMovementService } from "./features/stock-movements/application/stock-movement.service.js";
import { PrismaStockMovementRepository } from "./features/stock-movements/infrastructure/prisma-stock-movement.repository.js";
import { prisma } from "./shared/database/prisma.js";
import { errorHandler } from "./shared/errors/error-handler.js";
import { authMiddleware } from "./shared/middlewares/auth.middleware.js";

const healthRoute = createRoute({
  method: "get",
  path: "/health",
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({
            status: z.literal("ok"),
          }),
        },
      },
      description: "Service is healthy",
    },
  },
});

const app = new OpenAPIHono();
const categoryRepository = new PrismaCategoryRepository(prisma);
const categoryService = new CategoryService(categoryRepository);
const categoryReader: CategoryReader = {
  async findByUuid(uuid) {
    const category = await categoryRepository.findByUuid(uuid);

    return category
      ? { uuid: category.uuid, isActive: category.isActive }
      : null;
  },
};
const productService = new ProductService(
  new PrismaProductRepository(prisma),
  categoryReader,
);
const inventoryService = new InventoryService(
  new PrismaInventoryRepository(prisma),
);
const stockMovementService = new StockMovementService(
  new PrismaStockMovementRepository(prisma),
);
const authRoutes = createAuthRoutes();
const categoryRoutes = createCategoryRoutes({ service: categoryService });
const inventoryRoutes = createInventoryRoutes({ service: inventoryService });
const productRoutes = createProductRoutes({
  service: productService,
  authMiddleware,
});
const stockMovementInventoryRoutes = createStockMovementInventoryRoutes({
  service: stockMovementService,
  authMiddleware,
});
const stockMovementRoutes = createStockMovementListRoutes({
  service: stockMovementService,
});

stockMovementInventoryRoutes.route(
  "/",
  createStockMovementInventoryListRoutes({ service: stockMovementService }),
);

app.use("*", cors());
app.onError(errorHandler);

app.openapi(healthRoute, (context) => context.json({ status: "ok" }, 200));
app.route("/api/auth", authRoutes);
app.route("/products", productRoutes);
app.route("/categories", categoryRoutes);
app.route("/inventory", inventoryRoutes);
app.route("/inventory", stockMovementInventoryRoutes);
app.route("/stock-movements", stockMovementRoutes);

app.openAPIRegistry.registerComponent("securitySchemes", "sessionCookie", {
  type: "apiKey",
  in: "cookie",
  name: "better-auth.session_token",
  description: "Better Auth session cookie.",
});

app.doc("/openapi.json", {
  openapi: "3.0.3",
  info: {
    title: "Inventory API",
    version: "0.1.0",
  },
});

app.get("/docs", swaggerUI({ url: "/openapi.json" }));

export { app };
