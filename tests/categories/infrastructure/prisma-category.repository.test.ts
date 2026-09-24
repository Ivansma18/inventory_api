import { randomUUID } from "node:crypto";

import { afterEach, describe, expect, it } from "vitest";

import {
  createCategory,
  updateCategory,
  type Category,
} from "../../../src/features/categories/domain/category.entity.js";
import {
  categoryListTieBreakers,
  categorySortFields,
  type CategorySortField,
} from "../../../src/features/categories/domain/category.repository.js";
import { PrismaCategoryRepository } from "../../../src/features/categories/infrastructure/prisma-category.repository.js";
import { prisma } from "../../../src/shared/database/prisma.js";

const repository = new PrismaCategoryRepository(prisma);
let createdCategoryUuids: string[] = [];

afterEach(async () => {
  await prisma.category.deleteMany({
    where: { uuid: { in: createdCategoryUuids } },
  });
  createdCategoryUuids = [];
});

function createTestCategory(overrides: Partial<Category> = {}): Category {
  const timestamp = new Date("2026-09-23T10:00:00.000Z");
  const uuid = overrides.uuid ?? randomUUID();
  const name = overrides.name ?? `Category ${uuid}`;

  return {
    ...createCategory({
      uuid,
      name,
      description: "Created by an integration test",
      createdAt: timestamp,
      updatedAt: timestamp,
    }),
    ...overrides,
  };
}

describe("PrismaCategoryRepository", () => {
  it("creates and finds categories while preserving the domain representation", async () => {
    const category = createTestCategory();
    createdCategoryUuids.push(category.uuid);

    await expect(repository.create(category)).resolves.toEqual(category);
    await expect(repository.findByUuid(category.uuid)).resolves.toEqual(
      category,
    );
    await expect(
      repository.findByNameNormalized(category.nameNormalized),
    ).resolves.toEqual(category);
    await expect(repository.findByUuid(randomUUID())).resolves.toBeNull();
  });

  it("enforces unique normalized names in PostgreSQL", async () => {
    const category = createTestCategory({ name: "Office furniture" });
    const duplicate = createTestCategory({ name: "OFFICE FURNITURE" });
    createdCategoryUuids.push(category.uuid, duplicate.uuid);

    await repository.create(category);

    await expect(repository.create(duplicate)).rejects.toMatchObject({
      code: "P2002",
    });
  });

  it("updates persisted categories without losing nullable fields or state", async () => {
    const category = createTestCategory();
    createdCategoryUuids.push(category.uuid);
    await repository.create(category);

    const updatedCategory = updateCategory(
      category,
      {
        name: "Updated category",
        description: null,
        isActive: false,
      },
      new Date("2026-09-23T11:00:00.000Z"),
    );

    await expect(repository.update(updatedCategory)).resolves.toEqual(
      updatedCategory,
    );
    await expect(repository.findByUuid(category.uuid)).resolves.toEqual(
      updatedCategory,
    );
  });

  it("filters case-insensitively, combines search and state, and counts before pagination", async () => {
    const activeFurniture = createTestCategory({ name: "Office furniture" });
    const inactiveFurniture = createTestCategory({
      name: "Archived furniture",
      isActive: false,
    });
    const activeLighting = createTestCategory({ name: "Office lighting" });
    createdCategoryUuids.push(
      activeFurniture.uuid,
      inactiveFurniture.uuid,
      activeLighting.uuid,
    );

    await Promise.all([
      repository.create(activeFurniture),
      repository.create(inactiveFurniture),
      repository.create(activeLighting),
    ]);

    await expect(
      repository.findMany({
        page: 1,
        limit: 1,
        search: "fUrNiTuRe",
        isActive: true,
        sort: "name",
        order: "asc",
        tieBreakers: categoryListTieBreakers,
      }),
    ).resolves.toEqual({ categories: [activeFurniture], total: 1 });

    await expect(
      repository.findMany({
        page: 1,
        limit: 15,
        search: "furniture",
        isActive: false,
        sort: "name",
        order: "asc",
        tieBreakers: categoryListTieBreakers,
      }),
    ).resolves.toEqual({ categories: [inactiveFurniture], total: 1 });
  });

  it("paginates ordered matches and reports their unpaginated total", async () => {
    const categories = [
      createTestCategory({ name: "Alpha" }),
      createTestCategory({ name: "Bravo" }),
      createTestCategory({ name: "Charlie" }),
    ];
    createdCategoryUuids.push(...categories.map((category) => category.uuid));
    await Promise.all(
      categories.map((category) => repository.create(category)),
    );

    await expect(
      repository.findMany({
        page: 2,
        limit: 1,
        isActive: true,
        sort: "name",
        order: "asc",
        tieBreakers: categoryListTieBreakers,
      }),
    ).resolves.toEqual({ categories: [categories[1]], total: 3 });
  });

  it("orders every supported field in both directions", async () => {
    const categories = [
      createTestCategory({
        uuid: "00000000-0000-4000-8000-000000000001",
        name: "Bravo",
        createdAt: new Date("2026-09-23T12:00:00.000Z"),
        updatedAt: new Date("2026-09-23T14:00:00.000Z"),
      }),
      createTestCategory({
        uuid: "00000000-0000-4000-8000-000000000002",
        name: "Alpha",
        createdAt: new Date("2026-09-23T11:00:00.000Z"),
        updatedAt: new Date("2026-09-23T13:00:00.000Z"),
      }),
      createTestCategory({
        uuid: "00000000-0000-4000-8000-000000000003",
        name: "Charlie",
        createdAt: new Date("2026-09-23T13:00:00.000Z"),
        updatedAt: new Date("2026-09-23T12:00:00.000Z"),
      }),
    ];
    createdCategoryUuids.push(...categories.map((category) => category.uuid));
    await Promise.all(
      categories.map((category) => repository.create(category)),
    );

    const expectedAscending: Record<CategorySortField, readonly Category[]> = {
      name: [categories[1], categories[0], categories[2]],
      createdAt: [categories[1], categories[0], categories[2]],
      updatedAt: [categories[2], categories[1], categories[0]],
    } as const;

    for (const sort of categorySortFields) {
      const expected = expectedAscending[sort];

      await expect(
        repository.findMany({
          page: 1,
          limit: 15,
          isActive: true,
          sort,
          order: "asc",
          tieBreakers: categoryListTieBreakers,
        }),
      ).resolves.toEqual({ categories: expected, total: 3 });

      await expect(
        repository.findMany({
          page: 1,
          limit: 15,
          isActive: true,
          sort,
          order: "desc",
          tieBreakers: categoryListTieBreakers,
        }),
      ).resolves.toEqual({ categories: [...expected].reverse(), total: 3 });
    }
  });

  it("uses createdAt and UUID as stable ascending tie breakers", async () => {
    const categories = [
      createTestCategory({
        uuid: "00000000-0000-4000-8000-000000000003",
        name: "Tied C",
        createdAt: new Date("2026-09-23T12:00:00.000Z"),
      }),
      createTestCategory({
        uuid: "00000000-0000-4000-8000-000000000002",
        name: "Tied B",
        createdAt: new Date("2026-09-23T11:00:00.000Z"),
      }),
      createTestCategory({
        uuid: "00000000-0000-4000-8000-000000000001",
        name: "Tied A",
        createdAt: new Date("2026-09-23T11:00:00.000Z"),
      }),
    ];
    createdCategoryUuids.push(...categories.map((category) => category.uuid));
    await Promise.all(
      categories.map((category) => repository.create(category)),
    );

    await expect(
      repository.findMany({
        page: 1,
        limit: 15,
        isActive: true,
        sort: "createdAt",
        order: "asc",
        tieBreakers: categoryListTieBreakers,
      }),
    ).resolves.toEqual({
      categories: [categories[2], categories[1], categories[0]],
      total: 3,
    });
  });
});
