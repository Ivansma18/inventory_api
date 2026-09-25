export class InvalidStockMovementQuantityError extends Error {
  constructor() {
    super("Stock movement quantity must be a positive integer.");
    this.name = "InvalidStockMovementQuantityError";
  }
}

export class InvalidStockAdjustmentQuantityError extends Error {
  constructor() {
    super("Stock adjustment quantity must be a non-negative integer.");
    this.name = "InvalidStockAdjustmentQuantityError";
  }
}

export class InvalidStockMovementPreviousStockError extends Error {
  constructor() {
    super("Previous stock must be a non-negative integer.");
    this.name = "InvalidStockMovementPreviousStockError";
  }
}

export class InsufficientStockError extends Error {
  constructor() {
    super("Insufficient stock.");
    this.name = "InsufficientStockError";
  }
}

export class StockMovementProductNotFoundError extends Error {
  constructor() {
    super("Stock movement product was not found.");
    this.name = "StockMovementProductNotFoundError";
  }
}

export class StockMovementInventoryNotFoundError extends Error {
  constructor() {
    super("Stock movement inventory was not found.");
    this.name = "StockMovementInventoryNotFoundError";
  }
}
