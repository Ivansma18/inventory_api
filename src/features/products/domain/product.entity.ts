import {
  InvalidProductNameError,
  InvalidProductPriceError,
  InvalidProductSkuError,
} from "./product.errors.js";

export interface Product {
  uuid: string;
  sku: string;
  skuNormalized: string;
  name: string;
  description: string | null;
  purchasePrice: number;
  salePrice: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateProductData {
  uuid: string;
  sku: string;
  name: string;
  description?: string | null;
  purchasePrice: number;
  salePrice: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpdateProductData {
  sku?: string;
  name?: string;
  description?: string | null;
  purchasePrice?: number;
  salePrice?: number;
  isActive?: boolean;
}

export function createProduct(data: CreateProductData): Product {
  const sku = normalizeSku(data.sku);

  return {
    uuid: data.uuid,
    sku,
    skuNormalized: sku.toLowerCase(),
    name: normalizeName(data.name),
    description: data.description ?? null,
    purchasePrice: validatePrice(data.purchasePrice),
    salePrice: validatePrice(data.salePrice),
    isActive: true,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

export function updateProduct(
  product: Product,
  data: UpdateProductData,
  updatedAt: Date,
): Product {
  const sku = data.sku === undefined ? product.sku : normalizeSku(data.sku);

  return {
    ...product,
    sku,
    skuNormalized: sku.toLowerCase(),
    name: data.name === undefined ? product.name : normalizeName(data.name),
    description:
      data.description === undefined ? product.description : data.description,
    purchasePrice:
      data.purchasePrice === undefined
        ? product.purchasePrice
        : validatePrice(data.purchasePrice),
    salePrice:
      data.salePrice === undefined
        ? product.salePrice
        : validatePrice(data.salePrice),
    isActive: data.isActive === undefined ? product.isActive : data.isActive,
    updatedAt,
  };
}

function normalizeSku(sku: string | undefined): string {
  if (sku === undefined) {
    throw new InvalidProductSkuError();
  }

  const normalizedSku = sku.trim();

  if (!normalizedSku) {
    throw new InvalidProductSkuError();
  }

  return normalizedSku;
}

function normalizeName(name: string | undefined): string {
  if (name === undefined) {
    throw new InvalidProductNameError();
  }

  const normalizedName = name.trim();

  if (!normalizedName) {
    throw new InvalidProductNameError();
  }

  return normalizedName;
}

function validatePrice(price: number): number {
  const scaledPrice = price * 100;

  if (
    !Number.isFinite(price) ||
    price < 0 ||
    Math.abs(scaledPrice - Math.round(scaledPrice)) > 1e-8
  ) {
    throw new InvalidProductPriceError();
  }

  return price;
}
