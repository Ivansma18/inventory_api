import type { Category } from "./category.entity.js";

export const categorySortFields = ["name", "createdAt", "updatedAt"] as const;

export type CategorySortField = (typeof categorySortFields)[number];
export type SortDirection = "asc" | "desc";
export type CategoryTieBreakerField = "createdAt" | "uuid";

export interface CategoryTieBreaker {
  sort: CategoryTieBreakerField;
  order: "asc";
}

export const categoryListTieBreakers: readonly CategoryTieBreaker[] = [
  { sort: "createdAt", order: "asc" },
  { sort: "uuid", order: "asc" },
];

export interface CategoryListQuery {
  page: number;
  limit: number;
  search?: string;
  isActive: boolean;
  sort: CategorySortField;
  order: SortDirection;
  tieBreakers: readonly CategoryTieBreaker[];
}

export interface CategoryListResult {
  categories: Category[];
  total: number;
}

export type CategoryUsageCheckResult = "not_found" | "in_use";

export interface CategoryRepository {
  create(category: Category): Promise<Category>;
  findByNameNormalized(nameNormalized: string): Promise<Category | null>;
  findByUuid(uuid: string): Promise<Category | null>;
  findMany(query: CategoryListQuery): Promise<CategoryListResult>;
  update(category: Category): Promise<Category>;
  updateIfUnused(
    category: Category,
  ): Promise<Category | CategoryUsageCheckResult>;
  deleteIfUnused(uuid: string): Promise<"deleted" | CategoryUsageCheckResult>;
}
