import type { Product } from "../domain/product.entity.js";
import type { ProductListResult } from "../domain/product.repository.js";

export interface ProductResponse {
  uuid: string;
  sku: string;
  name: string;
  description: string | null;
  purchasePrice: number;
  salePrice: number;
  categoryUuid: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProductListResponse {
  data: ProductResponse[];
  pagination: {
    total: number;
    page: number;
    limit: number;
  };
}

export function toProductResponse(product: Product): ProductResponse {
  return {
    uuid: product.uuid,
    sku: product.sku,
    name: product.name,
    description: product.description,
    purchasePrice: product.purchasePrice,
    salePrice: product.salePrice,
    categoryUuid: product.categoryUuid,
    isActive: product.isActive,
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
  };
}

export function toProductListResponse(
  result: ProductListResult,
  page: number,
  limit: number,
): ProductListResponse {
  return {
    data: result.products.map(toProductResponse),
    pagination: {
      total: result.total,
      page,
      limit,
    },
  };
}
