import { describe, expect, it } from "vitest";

import { InvalidCategoryNameError } from "../../../src/features/categories/domain/category.errors.js";
import {
  type CreateCategoryData,
  createCategory,
  updateCategory,
} from "../../../src/features/categories/domain/category.entity.js";

const createdAt = new Date("2026-09-23T10:00:00.000Z");

function createInvalidCategoryData(
  data: Record<string, unknown>,
): CreateCategoryData {
  return data as unknown as CreateCategoryData;
}

function createValidCategory() {
  return createCategory({
    uuid: "a6b1a8ea-1f37-4f20-9f7c-913b3f548dd4",
    name: "  Office Furniture  ",
    description: "Desks and chairs",
    createdAt,
    updatedAt: createdAt,
  });
}

describe("Category", () => {
  it("creates an active category with a trimmed and normalized name", () => {
    expect(createValidCategory()).toEqual({
      uuid: "a6b1a8ea-1f37-4f20-9f7c-913b3f548dd4",
      name: "Office Furniture",
      nameNormalized: "office furniture",
      description: "Desks and chairs",
      isActive: true,
      createdAt,
      updatedAt: createdAt,
    });
  });

  it.each([undefined, "", "   "])("rejects an invalid name: %j", (name) => {
    expect(() =>
      createCategory(
        createInvalidCategoryData({
          ...createValidCategory(),
          name,
          createdAt,
          updatedAt: createdAt,
        }),
      ),
    ).toThrow(InvalidCategoryNameError);
  });

  it("treats equivalent capitalization and outer spaces as the same name", () => {
    expect(
      createCategory({
        ...createValidCategory(),
        name: "  OFFICE FURNITURE  ",
        createdAt,
        updatedAt: createdAt,
      }).nameNormalized,
    ).toBe(createValidCategory().nameNormalized);
  });

  it.each([undefined, null])(
    "creates a category without a description when it is %j",
    (description) => {
      expect(
        createCategory({
          ...createValidCategory(),
          description,
          createdAt,
          updatedAt: createdAt,
        }),
      ).toMatchObject({ description: null });
    },
  );

  it("preserves omitted fields, applies null, and updates state idempotently", () => {
    const category = createValidCategory();
    const updatedAt = new Date("2026-09-23T11:00:00.000Z");

    const renamed = updateCategory(
      category,
      { name: "  Ergonomic Furniture  " },
      updatedAt,
    );
    const withoutDescription = updateCategory(
      renamed,
      { description: null },
      updatedAt,
    );
    const inactive = updateCategory(
      withoutDescription,
      { isActive: false },
      updatedAt,
    );
    const stillInactive = updateCategory(
      inactive,
      { isActive: false },
      updatedAt,
    );

    expect(renamed).toMatchObject({
      name: "Ergonomic Furniture",
      nameNormalized: "ergonomic furniture",
      description: "Desks and chairs",
      isActive: true,
      updatedAt,
    });
    expect(withoutDescription).toMatchObject({ description: null, updatedAt });
    expect(inactive).toMatchObject({ isActive: false, updatedAt });
    expect(stillInactive).toMatchObject({ isActive: false, updatedAt });
  });
});
