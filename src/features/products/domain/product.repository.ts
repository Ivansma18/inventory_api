import type { Product } from "./product.entity.js";

export const productSortFields = [
  "name",
  "sku",
  "purchasePrice",
  "salePrice",
  "createdAt",
  "updatedAt",
] as const;

export type ProductSortField = (typeof productSortFields)[number];
export type SortDirection = "asc" | "desc";

export interface ProductListQuery {
  page: number;
  limit: number;
  search?: string;
  isActive: boolean;
  sort: ProductSortField;
  order: SortDirection;
}

export interface ProductListResult {
  products: Product[];
  total: number;
}

export interface ProductRepository {
  create(product: Product): Promise<Product>;
  findBySkuNormalized(skuNormalized: string): Promise<Product | null>;
  findByUuid(uuid: string): Promise<Product | null>;
  findMany(query: ProductListQuery): Promise<ProductListResult>;
  update(product: Product): Promise<Product>;
}
