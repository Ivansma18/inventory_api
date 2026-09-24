export class InvalidInventoryQuantityError extends Error {
  constructor() {
    super("Inventory quantity must be a non-negative integer.");
    this.name = "InvalidInventoryQuantityError";
  }
}

export class InvalidInventoryMinimumStockError extends Error {
  constructor() {
    super("Inventory minimum stock must be a non-negative integer.");
    this.name = "InvalidInventoryMinimumStockError";
  }
}
