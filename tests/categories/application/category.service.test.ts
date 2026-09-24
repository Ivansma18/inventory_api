import { describe, expect, it } from "vitest";

import {
  createCategory,
  updateCategory,
  type Category,
} from "../../../src/features/categories/domain/category.entity.js";
import {
  CategoryHasAssociatedProductsError,
  CategoryNameAlreadyExistsError,
  CategoryNotFoundError,
} from "../../../src/features/categories/domain/category.errors.js";
import type {
  CategoryListResult,
  CategoryRepository,
} from "../../../src/features/categories/domain/category.repository.js";
import { CategoryService } from "../../../src/features/categories/application/category.service.js";

class FakeCategoryRepository implements CategoryRepository {
  private readonly categories = new Map<string, Category>();
  private readonly associatedCategoryUuids: ReadonlySet<string>;

  constructor(
    categories: Category[] = [],
    associatedCategoryUuids: readonly string[] = [],
  ) {
    for (const category of categories) {
      this.categories.set(category.uuid, category);
    }
    this.associatedCategoryUuids = new Set(associatedCategoryUuids);
  }

  async create(category: Category): Promise<Category> {
    this.categories.set(category.uuid, category);
    return category;
  }

  async findByNameNormalized(nameNormalized: string): Promise<Category | null> {
    return (
      [...this.categories.values()].find(
        (category) => category.nameNormalized === nameNormalized,
      ) ?? null
    );
  }

  async findByUuid(uuid: string): Promise<Category | null> {
    return this.categories.get(uuid) ?? null;
  }

  async findMany(): Promise<CategoryListResult> {
    throw new Error("Listing is not part of this fake repository yet.");
  }

  async update(category: Category): Promise<Category> {
    this.categories.set(category.uuid, category);
    return category;
  }

  async deleteIfUnused(
    uuid: string,
  ): Promise<"deleted" | "not_found" | "in_use"> {
    if (!this.categories.has(uuid)) {
      return "not_found";
    }

    if (this.associatedCategoryUuids.has(uuid)) {
      return "in_use";
    }

    this.categories.delete(uuid);
    return "deleted";
  }

  async updateIfUnused(
    category: Category,
  ): Promise<Category | "not_found" | "in_use"> {
    if (!this.categories.has(category.uuid)) {
      return "not_found";
    }

    if (this.associatedCategoryUuids.has(category.uuid)) {
      return "in_use";
    }

    this.categories.set(category.uuid, category);
    return category;
  }
}

function createStoredCategory(overrides: Partial<Category> = {}): Category {
  const createdAt = new Date("2026-09-23T10:00:00.000Z");

  return {
    ...createCategory({
      uuid: "a6b1a8ea-1f37-4f20-9f7c-913b3f548dd4",
      name: "Office furniture",
      description: "Desks and chairs",
      createdAt,
      updatedAt: createdAt,
    }),
    ...overrides,
  };
}

function createService(
  categories: Category[] = [],
  associatedCategoryUuids: readonly string[] = [],
) {
  const repository = new FakeCategoryRepository(
    categories,
    associatedCategoryUuids,
  );
  const timestamp = new Date("2026-09-23T11:00:00.000Z");
  const service = new CategoryService(
    repository,
    () => "e3b0c442-98fc-4c14-9afb-0d8ac4e6f4b1",
    () => timestamp,
  );

  return { service, timestamp };
}

describe("CategoryService", () => {
  it("creates an active category with a generated UUID and timestamps", async () => {
    const { service, timestamp } = createService();

    await expect(
      service.createCategory({
        name: "  Adjustable desks  ",
        description: null,
      }),
    ).resolves.toEqual({
      uuid: "e3b0c442-98fc-4c14-9afb-0d8ac4e6f4b1",
      name: "Adjustable desks",
      nameNormalized: "adjustable desks",
      description: null,
      isActive: true,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  });

  it("rejects duplicate names even when the existing category is inactive", async () => {
    const inactiveCategory = updateCategory(
      createStoredCategory(),
      { isActive: false },
      new Date("2026-09-23T10:01:00.000Z"),
    );
    const { service } = createService([inactiveCategory]);

    await expect(
      service.createCategory({ name: "  OFFICE FURNITURE  " }),
    ).rejects.toThrow(CategoryNameAlreadyExistsError);
  });

  it("returns a category by UUID and rejects an unknown UUID", async () => {
    const storedCategory = createStoredCategory();
    const { service } = createService([storedCategory]);

    await expect(service.getCategory(storedCategory.uuid)).resolves.toEqual(
      storedCategory,
    );
    await expect(service.getCategory("unknown")).rejects.toThrow(
      CategoryNotFoundError,
    );
  });

  it("updates only provided fields and preserves omitted description and state", async () => {
    const storedCategory = createStoredCategory();
    const { service, timestamp } = createService([storedCategory]);

    await expect(
      service.updateCategory(storedCategory.uuid, {
        name: "  Ergonomic furniture  ",
      }),
    ).resolves.toMatchObject({
      name: "Ergonomic furniture",
      nameNormalized: "ergonomic furniture",
      description: "Desks and chairs",
      isActive: true,
      updatedAt: timestamp,
    });
  });

  it("removes a description when it is explicitly null", async () => {
    const storedCategory = createStoredCategory();
    const { service } = createService([storedCategory]);

    await expect(
      service.updateCategory(storedCategory.uuid, { description: null }),
    ).resolves.toMatchObject({ description: null });
  });

  it("allows a category to keep its own normalized name", async () => {
    const storedCategory = createStoredCategory();
    const { service } = createService([storedCategory]);

    await expect(
      service.updateCategory(storedCategory.uuid, {
        name: "  OFFICE FURNITURE  ",
      }),
    ).resolves.toMatchObject({
      name: "OFFICE FURNITURE",
      nameNormalized: "office furniture",
    });
  });

  it("rejects an update that takes another category name", async () => {
    const firstCategory = createStoredCategory();
    const secondCategory = createStoredCategory({
      uuid: "9d1c7e33-98fc-4c14-9afb-0d8ac4e6f4b1",
      name: "Lighting",
      nameNormalized: "lighting",
    });
    const { service } = createService([firstCategory, secondCategory]);

    await expect(
      service.updateCategory(secondCategory.uuid, { name: "office furniture" }),
    ).rejects.toThrow(CategoryNameAlreadyExistsError);
  });

  it("changes state idempotently", async () => {
    const storedCategory = createStoredCategory();
    const { service } = createService([storedCategory]);

    await service.updateCategory(storedCategory.uuid, { isActive: false });
    await expect(
      service.updateCategory(storedCategory.uuid, { isActive: false }),
    ).resolves.toMatchObject({ isActive: false });

    await service.updateCategory(storedCategory.uuid, { isActive: true });
    await expect(
      service.updateCategory(storedCategory.uuid, { isActive: true }),
    ).resolves.toMatchObject({ isActive: true });
  });

  it("rejects deactivation when products are associated", async () => {
    const storedCategory = createStoredCategory();
    const { service } = createService([storedCategory], [storedCategory.uuid]);

    await expect(
      service.updateCategory(storedCategory.uuid, { isActive: false }),
    ).rejects.toThrow(CategoryHasAssociatedProductsError);
  });

  it("permanently deletes unused categories and rejects categories in use", async () => {
    const unusedCategory = createStoredCategory();
    const usedCategory = createStoredCategory({
      uuid: "9d1c7e33-98fc-4c14-9afb-0d8ac4e6f4b1",
      name: "Lighting",
      nameNormalized: "lighting",
    });
    const { service } = createService(
      [unusedCategory, usedCategory],
      [usedCategory.uuid],
    );

    await expect(service.deleteCategory(unusedCategory.uuid)).resolves.toEqual({
      uuid: unusedCategory.uuid,
    });
    await expect(service.getCategory(unusedCategory.uuid)).rejects.toThrow(
      CategoryNotFoundError,
    );
    await expect(service.deleteCategory(usedCategory.uuid)).rejects.toThrow(
      CategoryHasAssociatedProductsError,
    );
  });
});
