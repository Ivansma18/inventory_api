import { randomUUID } from "node:crypto";

import {
  createCategory,
  updateCategory,
  type Category,
  type UpdateCategoryData,
} from "../domain/category.entity.js";
import {
  CategoryNameAlreadyExistsError,
  CategoryNotFoundError,
} from "../domain/category.errors.js";
import type { CategoryRepository } from "../domain/category.repository.js";

export interface CreateCategoryInput {
  name: string;
  description?: string | null;
}

export type UpdateCategoryInput = UpdateCategoryData;

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

    return this.categories.update(updatedCategory);
  }
}
