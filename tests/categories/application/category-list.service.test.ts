import { describe, expect, it } from "vitest";

import { CategoryService } from "../../../src/features/categories/application/category.service.js";
import {
  createCategory,
  type Category,
} from "../../../src/features/categories/domain/category.entity.js";
import type {
  CategoryListQuery,
  CategoryListResult,
  CategoryRepository,
  CategorySortField,
} from "../../../src/features/categories/domain/category.repository.js";

class CategoryListSpyRepository implements CategoryRepository {
  receivedQuery: CategoryListQuery | undefined;

  constructor(private readonly result: CategoryListResult) {}

  async create(category: Category): Promise<Category> {
    return category;
  }

  async findByNameNormalized(): Promise<Category | null> {
    return null;
  }

  async findByUuid(): Promise<Category | null> {
    return null;
  }

  async findMany(query: CategoryListQuery): Promise<CategoryListResult> {
    this.receivedQuery = query;
    return this.result;
  }

  async update(category: Category): Promise<Category> {
    return category;
  }

  async deleteByUuid(): Promise<void> {}

  async hasAssociatedProducts(): Promise<boolean> {
    return false;
  }
}

function createListedCategory(): Category {
  const timestamp = new Date("2026-09-23T10:00:00.000Z");

  return createCategory({
    uuid: "a6b1a8ea-1f37-4f20-9f7c-913b3f548dd4",
    name: "Office furniture",
    createdAt: timestamp,
    updatedAt: timestamp,
  });
}

function createService(total = 1) {
  const category = createListedCategory();
  const repository = new CategoryListSpyRepository({
    categories: [category],
    total,
  });

  return { category, repository, service: new CategoryService(repository) };
}

describe("CategoryService.listCategories", () => {
  it("uses active categories, pagination and name ordering by default", async () => {
    const { category, repository, service } = createService(3);

    await expect(service.listCategories()).resolves.toEqual({
      categories: [category],
      total: 3,
    });
    expect(repository.receivedQuery).toEqual({
      page: 1,
      limit: 15,
      isActive: true,
      sort: "name",
      order: "asc",
      tieBreakers: [
        { sort: "createdAt", order: "asc" },
        { sort: "uuid", order: "asc" },
      ],
    });
  });

  it("passes filters, pagination and ordering together", async () => {
    const { repository, service } = createService();

    await service.listCategories({
      page: 2,
      limit: 25,
      search: "  furniture  ",
      isActive: false,
      sort: "updatedAt",
      order: "desc",
    });

    expect(repository.receivedQuery).toEqual({
      page: 2,
      limit: 25,
      search: "furniture",
      isActive: false,
      sort: "updatedAt",
      order: "desc",
      tieBreakers: [
        { sort: "createdAt", order: "asc" },
        { sort: "uuid", order: "asc" },
      ],
    });
  });

  it("treats blank search as omitted", async () => {
    const { repository, service } = createService();

    await service.listCategories({ search: "   " });

    expect(repository.receivedQuery).not.toHaveProperty("search");
  });

  it.each(["name", "createdAt", "updatedAt"] as const)(
    "accepts %s as a sort field",
    async (sort: CategorySortField) => {
      const { repository, service } = createService();

      await service.listCategories({ sort });

      expect(repository.receivedQuery).toMatchObject({ sort });
    },
  );
});
