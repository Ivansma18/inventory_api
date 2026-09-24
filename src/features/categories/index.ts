import { CategoryService } from "./application/category.service.js";
import { PrismaCategoryRepository } from "./infrastructure/prisma-category.repository.js";
import { createCategoryRoutes } from "./http/category.routes.js";
import { prisma } from "../../shared/database/prisma.js";

export interface CategoryReader {
  findByUuid(uuid: string): Promise<CategoryStatus | null>;
}

export interface CategoryStatus {
  uuid: string;
  isActive: boolean;
}

const categoryRepository = new PrismaCategoryRepository(prisma);
const categoryService = new CategoryService(categoryRepository);

export const categoryRoutes = createCategoryRoutes({
  service: categoryService,
});

export const categoryReader: CategoryReader = {
  async findByUuid(uuid) {
    const category = await categoryRepository.findByUuid(uuid);

    return category
      ? { uuid: category.uuid, isActive: category.isActive }
      : null;
  },
};
