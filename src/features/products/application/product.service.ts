import { randomUUID } from "node:crypto";

import {
  createProduct,
  updateProduct,
  type Product,
  type UpdateProductData,
} from "../domain/product.entity.js";
import {
  ProductNotFoundError,
  ProductSkuAlreadyExistsError,
} from "../domain/product.errors.js";
import type { ProductRepository } from "../domain/product.repository.js";

export interface CreateProductInput {
  sku: string;
  name: string;
  description?: string | null;
  purchasePrice: number;
  salePrice: number;
}

export type UpdateProductInput = UpdateProductData;

export class ProductService {
  constructor(
    private readonly products: ProductRepository,
    private readonly generateUuid: () => string = randomUUID,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async createProduct(input: CreateProductInput): Promise<Product> {
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

  async updateProduct(
    uuid: string,
    input: UpdateProductInput,
  ): Promise<Product> {
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
}
