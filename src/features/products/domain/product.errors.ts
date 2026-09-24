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

export class ProductCategoryNotFoundError extends Error {
  constructor() {
    super("Product category was not found.");
    this.name = "ProductCategoryNotFoundError";
  }
}

export class ProductCategoryInactiveError extends Error {
  constructor() {
    super("Product category is inactive.");
    this.name = "ProductCategoryInactiveError";
  }
}

export class ProductCategoryAssignmentConflictError extends Error {
  constructor() {
    super("Product category assignment could not be completed.");
    this.name = "ProductCategoryAssignmentConflictError";
  }
}
