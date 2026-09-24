import { describe, expect, it } from "vitest";

import { createCategory } from "../../../src/features/categories/domain/category.entity.js";
import {
  toCategoryListResponse,
  toCategoryResponse,
} from "../../../src/features/categories/http/category.mapper.js";
import {
  categoryListQuerySchema,
  categoryParamsSchema,
  createCategorySchema,
  updateCategorySchema,
} from "../../../src/features/categories/http/category.schemas.js";

describe("Category HTTP schemas", () => {
  it("trims valid create inputs and strips unrecognized properties", () => {
    expect(
      createCategorySchema.parse({
        name: "  Office furniture  ",
        description: "Desks and chairs",
        ignored: "value",
      }),
    ).toEqual({
      name: "Office furniture",
      description: "Desks and chairs",
    });
  });

  it("accepts omitted and null descriptions while rejecting blank names", () => {
    expect(createCategorySchema.parse({ name: "Lighting" })).toEqual({
      name: "Lighting",
    });
    expect(
      createCategorySchema.parse({ name: "Lighting", description: null }),
    ).toEqual({ name: "Lighting", description: null });
    expect(() => createCategorySchema.parse({ name: "   " })).toThrow();
  });

  it("strips extra update properties and rejects updates without recognized fields", () => {
    expect(
      updateCategorySchema.parse({
        name: "  Lighting  ",
        description: null,
        isActive: false,
        ignored: "value",
      }),
    ).toEqual({ name: "Lighting", description: null, isActive: false });
    expect(() => updateCategorySchema.parse({ ignored: "value" })).toThrow();
  });

  it("validates UUID params and coerces valid list query parameters", () => {
    expect(
      categoryParamsSchema.parse({
        uuid: "550e8400-e29b-41d4-a716-446655440000",
      }),
    ).toEqual({ uuid: "550e8400-e29b-41d4-a716-446655440000" });
    expect(() => categoryParamsSchema.parse({ uuid: "not-a-uuid" })).toThrow();

    expect(
      categoryListQuerySchema.parse({
        page: "2",
        limit: "25",
        search: "  furniture  ",
        isActive: "false",
        sort: "updatedAt",
        order: "desc",
      }),
    ).toEqual({
      page: 2,
      limit: 25,
      search: "  furniture  ",
      isActive: false,
      sort: "updatedAt",
      order: "desc",
    });
  });

  it("rejects invalid pagination, state, sort, and order query values", () => {
    for (const query of [
      { page: "0" },
      { limit: "101" },
      { page: "1.5" },
      { isActive: "yes" },
      { sort: "id" },
      { order: "ascending" },
    ]) {
      expect(() => categoryListQuerySchema.parse(query)).toThrow();
    }
  });
});

describe("Category HTTP mappers", () => {
  it("serializes public category data without persistence-only fields", () => {
    const category = createCategory({
      uuid: "550e8400-e29b-41d4-a716-446655440000",
      name: "Office furniture",
      description: null,
      createdAt: new Date("2026-09-23T10:00:00.000Z"),
      updatedAt: new Date("2026-09-23T11:00:00.000Z"),
    });

    expect(toCategoryResponse(category)).toEqual({
      uuid: category.uuid,
      name: category.name,
      description: null,
      isActive: true,
      createdAt: "2026-09-23T10:00:00.000Z",
      updatedAt: "2026-09-23T11:00:00.000Z",
    });
    expect(toCategoryResponse(category)).not.toHaveProperty("nameNormalized");

    expect(
      toCategoryListResponse({ categories: [category], total: 1 }, 1, 15),
    ).toEqual({
      data: [toCategoryResponse(category)],
      pagination: { total: 1, page: 1, limit: 15 },
    });
  });
});
