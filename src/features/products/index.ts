import { ProductService } from "./application/product.service.js";
import { categoryReader } from "../categories/index.js";
import { PrismaProductRepository } from "./infrastructure/prisma-product.repository.js";
import { createProductRoutes } from "./http/product.routes.js";
import { prisma } from "../../shared/database/prisma.js";
import { authMiddleware } from "../../shared/middlewares/auth.middleware.js";

const productRepository = new PrismaProductRepository(prisma);
const productService = new ProductService(productRepository, categoryReader);

export const productRoutes = createProductRoutes({
  service: productService,
  authMiddleware,
});
