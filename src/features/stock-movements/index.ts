import { StockMovementService } from "./application/stock-movement.service.js";
import { PrismaStockMovementRepository } from "./infrastructure/prisma-stock-movement.repository.js";
import {
  createStockMovementInventoryListRoutes,
  createStockMovementListRoutes,
} from "./http/stock-movement-list.routes.js";
import { createStockMovementInventoryRoutes } from "./http/stock-movement.routes.js";
import { prisma } from "../../shared/database/prisma.js";
import { authMiddleware } from "../../shared/middlewares/auth.middleware.js";

const stockMovementRepository = new PrismaStockMovementRepository(prisma);
const stockMovementService = new StockMovementService(stockMovementRepository);

export const stockMovementInventoryRoutes = createStockMovementInventoryRoutes({
  service: stockMovementService,
  authMiddleware,
});

stockMovementInventoryRoutes.route(
  "/",
  createStockMovementInventoryListRoutes({ service: stockMovementService }),
);

export const stockMovementRoutes = createStockMovementListRoutes({
  service: stockMovementService,
});
