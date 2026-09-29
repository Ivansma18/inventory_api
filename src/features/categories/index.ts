export interface CategoryReader {
  findByUuid(uuid: string): Promise<CategoryStatus | null>;
}

export interface CategoryStatus {
  uuid: string;
  isActive: boolean;
}

export { createCategoryRoutes } from "./http/category.routes.js";
