import { randomUUID } from "node:crypto";

import {
  createProduct,
  updateProduct,
  type Product,
  type UpdateProductData,
} from "../domain/product.entity.js";
import {
  ProductCategoryInactiveError,
  ProductCategoryNotFoundError,
  ProductNotFoundError,
  ProductSkuAlreadyExistsError,
} from "../domain/product.errors.js";
import {
  productListTieBreakers,
  type ProductListResult,
  type ProductRepository,
  type ProductSortField,
  type SortDirection,
} from "../domain/product.repository.js";
import type { CategoryReader } from "../../categories/index.js";

export interface CreateProductInput {
  sku: string;
  name: string;
  description?: string | null;
  purchasePrice: number;
  salePrice: number;
  categoryUuid?: string;
}

export type UpdateProductInput = UpdateProductData;

export interface ListProductsInput {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
  sort?: ProductSortField;
  order?: SortDirection;
}

export class ProductService {
  constructor(
    private readonly products: ProductRepository,
    private readonly categories: CategoryReader,
    private readonly generateUuid: () => string = randomUUID,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async createProduct(input: CreateProductInput): Promise<Product> {
    await this.requireActiveCategory(input.categoryUuid);
    const timestamp = this.now();
    const product = createProduct({
      ...input,
      uuid: this.generateUuid(),
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    const existingProduct = await this.products.findBySkuNormalized(
      product.skuNormalized,
    );

    if (existingProduct) {
      throw new ProductSkuAlreadyExistsError();
    }

    return this.products.create(product);
  }

  async getProduct(uuid: string): Promise<Product> {
    const product = await this.products.findByUuid(uuid);

    if (!product) {
      throw new ProductNotFoundError();
    }

    return product;
  }

  async listProducts(
    input: ListProductsInput = {},
  ): Promise<ProductListResult> {
    const search = input.search?.trim();

    return this.products.findMany({
      page: input.page ?? 1,
      limit: input.limit ?? 15,
      ...(search ? { search } : {}),
      isActive: input.isActive ?? true,
      sort: input.sort ?? "name",
      order: input.order ?? "asc",
      tieBreakers: productListTieBreakers,
    });
  }

  async updateProduct(
    uuid: string,
    input: UpdateProductInput,
  ): Promise<Product> {
    if (input.categoryUuid !== undefined) {
      await this.requireActiveCategory(input.categoryUuid);
    }

    const product = await this.getProduct(uuid);
    const updatedProduct = updateProduct(product, input, this.now());

    if (updatedProduct.skuNormalized !== product.skuNormalized) {
      const existingProduct = await this.products.findBySkuNormalized(
        updatedProduct.skuNormalized,
      );

      if (existingProduct && existingProduct.uuid !== product.uuid) {
        throw new ProductSkuAlreadyExistsError();
      }
    }

    return this.products.update(updatedProduct);
  }

  private async requireActiveCategory(
    categoryUuid: string | undefined,
  ): Promise<void> {
    const category = categoryUuid
      ? await this.categories.findByUuid(categoryUuid)
      : null;

    if (!category) {
      throw new ProductCategoryNotFoundError();
    }

    if (!category.isActive) {
      throw new ProductCategoryInactiveError();
    }
  }
}
