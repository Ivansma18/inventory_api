import { InventoryService } from "./application/inventory.service.js";
import { PrismaInventoryRepository } from "./infrastructure/prisma-inventory.repository.js";
import { createInventoryRoutes } from "./http/inventory.routes.js";
import { prisma } from "../../shared/database/prisma.js";

const inventoryRepository = new PrismaInventoryRepository(prisma);
const inventoryService = new InventoryService(inventoryRepository);

export const inventoryRoutes = createInventoryRoutes({
  service: inventoryService,
});
