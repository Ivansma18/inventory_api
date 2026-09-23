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
export type ProductTieBreakerField = "createdAt" | "uuid";

export interface ProductTieBreaker {
  sort: ProductTieBreakerField;
  order: "asc";
}

export const productListTieBreakers: readonly ProductTieBreaker[] = [
  { sort: "createdAt", order: "asc" },
  { sort: "uuid", order: "asc" },
];

export interface ProductListQuery {
  page: number;
  limit: number;
  search?: string;
  isActive: boolean;
  sort: ProductSortField;
  order: SortDirection;
  tieBreakers: readonly ProductTieBreaker[];
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
