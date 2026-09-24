import { randomUUID } from "node:crypto";

import {
  createCategory,
  updateCategory,
  type Category,
  type UpdateCategoryData,
} from "../domain/category.entity.js";
import {
  CategoryHasAssociatedProductsError,
  CategoryNameAlreadyExistsError,
  CategoryNotFoundError,
} from "../domain/category.errors.js";
import {
  categoryListTieBreakers,
  type CategoryListResult,
  type CategoryRepository,
  type CategorySortField,
  type SortDirection,
} from "../domain/category.repository.js";

export interface CreateCategoryInput {
  name: string;
  description?: string | null;
}

export type UpdateCategoryInput = UpdateCategoryData;

export interface ListCategoriesInput {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
  sort?: CategorySortField;
  order?: SortDirection;
}

export class CategoryService {
  constructor(
    private readonly categories: CategoryRepository,
    private readonly generateUuid: () => string = randomUUID,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async createCategory(input: CreateCategoryInput): Promise<Category> {
    const timestamp = this.now();
    const category = createCategory({
      ...input,
      uuid: this.generateUuid(),
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    const existingCategory = await this.categories.findByNameNormalized(
      category.nameNormalized,
    );

    if (existingCategory) {
      throw new CategoryNameAlreadyExistsError();
    }

    return this.categories.create(category);
  }

  async getCategory(uuid: string): Promise<Category> {
    const category = await this.categories.findByUuid(uuid);

    if (!category) {
      throw new CategoryNotFoundError();
    }

    return category;
  }

  async listCategories(
    input: ListCategoriesInput = {},
  ): Promise<CategoryListResult> {
    const search = input.search?.trim();

    return this.categories.findMany({
      page: input.page ?? 1,
      limit: input.limit ?? 15,
      ...(search ? { search } : {}),
      isActive: input.isActive ?? true,
      sort: input.sort ?? "name",
      order: input.order ?? "asc",
      tieBreakers: categoryListTieBreakers,
    });
  }

  async updateCategory(
    uuid: string,
    input: UpdateCategoryInput,
  ): Promise<Category> {
    const category = await this.getCategory(uuid);
    const updatedCategory = updateCategory(category, input, this.now());

    if (updatedCategory.nameNormalized !== category.nameNormalized) {
      const existingCategory = await this.categories.findByNameNormalized(
        updatedCategory.nameNormalized,
      );

      if (existingCategory && existingCategory.uuid !== category.uuid) {
        throw new CategoryNameAlreadyExistsError();
      }
    }

    if (input.isActive !== false) {
      return this.categories.update(updatedCategory);
    }

    const result = await this.categories.updateIfUnused(updatedCategory);

    if (result === "in_use") {
      throw new CategoryHasAssociatedProductsError();
    }

    if (result === "not_found") {
      throw new CategoryNotFoundError();
    }

    return result;
  }

  async deleteCategory(uuid: string): Promise<{ uuid: string }> {
    const result = await this.categories.deleteIfUnused(uuid);

    if (result === "in_use") {
      throw new CategoryHasAssociatedProductsError();
    }

    if (result === "not_found") {
      throw new CategoryNotFoundError();
    }

    return { uuid };
  }
}
