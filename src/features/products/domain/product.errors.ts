export class InvalidProductSkuError extends Error {
  constructor() {
    super("Product SKU must not be empty.");
    this.name = "InvalidProductSkuError";
  }
}

export class InvalidProductNameError extends Error {
  constructor() {
    super("Product name must not be empty.");
    this.name = "InvalidProductNameError";
  }
}

export class InvalidProductPriceError extends Error {
  constructor() {
    super(
      "Product prices must be non-negative values with at most two decimal places.",
    );
    this.name = "InvalidProductPriceError";
  }
}

export class ProductNotFoundError extends Error {
  constructor() {
    super("Product was not found.");
    this.name = "ProductNotFoundError";
  }
}

export class ProductSkuAlreadyExistsError extends Error {
  constructor() {
    super("Product SKU already exists.");
    this.name = "ProductSkuAlreadyExistsError";
  }
}
