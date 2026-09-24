import type { Category } from "../domain/category.entity.js";
import type { CategoryListResult } from "../domain/category.repository.js";

export interface CategoryResponse {
  uuid: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryListResponse {
  data: CategoryResponse[];
  pagination: {
    total: number;
    page: number;
    limit: number;
  };
}

export function toCategoryResponse(category: Category): CategoryResponse {
  return {
    uuid: category.uuid,
    name: category.name,
    description: category.description,
    isActive: category.isActive,
    createdAt: category.createdAt.toISOString(),
    updatedAt: category.updatedAt.toISOString(),
  };
}

export function toCategoryListResponse(
  result: CategoryListResult,
  page: number,
  limit: number,
): CategoryListResponse {
  return {
    data: result.categories.map(toCategoryResponse),
    pagination: {
      total: result.total,
      page,
      limit,
    },
  };
}
