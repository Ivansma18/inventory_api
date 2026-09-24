export class InvalidCategoryNameError extends Error {
  constructor() {
    super("Category name must not be empty.");
    this.name = "InvalidCategoryNameError";
  }
}

export class CategoryNotFoundError extends Error {
  constructor() {
    super("Category was not found.");
    this.name = "CategoryNotFoundError";
  }
}

export class CategoryNameAlreadyExistsError extends Error {
  constructor() {
    super("Category name already exists.");
    this.name = "CategoryNameAlreadyExistsError";
  }
}

export class CategoryHasAssociatedProductsError extends Error {
  constructor() {
    super("Category has associated products.");
    this.name = "CategoryHasAssociatedProductsError";
  }
}

export class CategoryInactiveError extends Error {
  constructor() {
    super("Category is inactive.");
    this.name = "CategoryInactiveError";
  }
}
