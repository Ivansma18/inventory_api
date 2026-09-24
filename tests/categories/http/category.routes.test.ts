import { describe, expect, it } from "vitest";

import {
  CategoryHasAssociatedProductsError,
  CategoryNameAlreadyExistsError,
  CategoryNotFoundError,
} from "../../../src/features/categories/domain/category.errors.js";
import { createCategory } from "../../../src/features/categories/domain/category.entity.js";
import {
  createCategoryRoutes,
  type CategoryHttpService,
} from "../../../src/features/categories/http/category.routes.js";

const category = createCategory({
  uuid: "550e8400-e29b-41d4-a716-446655440000",
  name: "Office furniture",
  description: "Desks and chairs",
  createdAt: new Date("2026-09-23T10:00:00.000Z"),
  updatedAt: new Date("2026-09-23T10:00:00.000Z"),
});

function createService(
  overrides: Partial<CategoryHttpService> = {},
): CategoryHttpService {
  return {
    createCategory: async () => category,
    getCategory: async () => category,
    listCategories: async () => ({ categories: [category], total: 1 }),
    updateCategory: async () => category,
    deleteCategory: async () => ({ uuid: category.uuid }),
    ...overrides,
  };
}

describe("Category routes", () => {
  it("creates categories from recognized fields and returns public data", async () => {
    let receivedInput: unknown;
    const app = createCategoryRoutes({
      service: createService({
        createCategory: async (input) => {
          receivedInput = input;
          return category;
        },
      }),
    });

    const response = await app.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "  Office furniture  ",
        description: null,
        ignored: "value",
      }),
    });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      data: {
        uuid: category.uuid,
        name: category.name,
        description: category.description,
        isActive: true,
        createdAt: "2026-09-23T10:00:00.000Z",
        updatedAt: "2026-09-23T10:00:00.000Z",
      },
    });
    expect(receivedInput).toEqual({
      name: "Office furniture",
      description: null,
    });
  });

  it("returns 400 for invalid creation inputs and invalid UUIDs", async () => {
    const app = createCategoryRoutes({ service: createService() });

    const [invalidCategory, invalidUuid] = await Promise.all([
      app.request("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "" }),
      }),
      app.request("/not-a-uuid"),
    ]);

    expect(invalidCategory.status).toBe(400);
    expect(invalidUuid.status).toBe(400);
  });

  it("gets a category and translates not-found errors", async () => {
    const foundApp = createCategoryRoutes({ service: createService() });
    const missingApp = createCategoryRoutes({
      service: createService({
        getCategory: async () => {
          throw new CategoryNotFoundError();
        },
      }),
    });

    const [found, missing] = await Promise.all([
      foundApp.request(`/${category.uuid}`),
      missingApp.request(`/${category.uuid}`),
    ]);

    expect(found.status).toBe(200);
    await expect(found.json()).resolves.toMatchObject({
      data: { uuid: category.uuid, isActive: true },
    });
    expect(missing.status).toBe(404);
    await expect(missing.json()).resolves.toEqual({
      error: {
        code: "CATEGORY_NOT_FOUND",
        message: "Category was not found.",
      },
    });
  });

  it("updates recognized fields and translates category conflicts", async () => {
    let receivedUuid: string | undefined;
    let receivedInput: unknown;
    const updatedCategory = { ...category, description: null, isActive: false };
    const app = createCategoryRoutes({
      service: createService({
        updateCategory: async (uuid, input) => {
          receivedUuid = uuid;
          receivedInput = input;
          return updatedCategory;
        },
      }),
    });
    const conflictApp = createCategoryRoutes({
      service: createService({
        updateCategory: async () => {
          throw new CategoryNameAlreadyExistsError();
        },
      }),
    });
    const associatedProductsApp = createCategoryRoutes({
      service: createService({
        updateCategory: async () => {
          throw new CategoryHasAssociatedProductsError();
        },
      }),
    });

    const [response, conflict, associatedProducts] = await Promise.all([
      app.request(`/${category.uuid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: null,
          isActive: false,
          ignored: true,
        }),
      }),
      conflictApp.request(`/${category.uuid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Lighting" }),
      }),
      associatedProductsApp.request(`/${category.uuid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: false }),
      }),
    ]);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: { description: null, isActive: false },
    });
    expect(receivedUuid).toBe(category.uuid);
    expect(receivedInput).toEqual({ description: null, isActive: false });
    expect(conflict.status).toBe(409);
    await expect(conflict.json()).resolves.toEqual({
      error: {
        code: "CATEGORY_NAME_ALREADY_EXISTS",
        message: "Category name already exists.",
      },
    });
    expect(associatedProducts.status).toBe(409);
  });

  it("lists categories with supplied filters and pagination defaults", async () => {
    let receivedInput: unknown;
    const app = createCategoryRoutes({
      service: createService({
        listCategories: async (input) => {
          receivedInput = input;
          return { categories: [category], total: 3 };
        },
      }),
    });

    const response = await app.request(
      "/?page=2&limit=25&search=%20furniture%20&isActive=false&sort=updatedAt&order=desc",
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: [{ uuid: category.uuid }],
      pagination: { total: 3, page: 2, limit: 25 },
    });
    expect(receivedInput).toEqual({
      page: 2,
      limit: 25,
      search: " furniture ",
      isActive: false,
      sort: "updatedAt",
      order: "desc",
    });

    const defaultResponse = await app.request("/");
    expect(defaultResponse.status).toBe(200);
    expect(receivedInput).toEqual({});
  });

  it("deletes categories and translates deletion conflicts", async () => {
    const app = createCategoryRoutes({ service: createService() });
    const conflictApp = createCategoryRoutes({
      service: createService({
        deleteCategory: async () => {
          throw new CategoryHasAssociatedProductsError();
        },
      }),
    });

    const [deleted, conflict] = await Promise.all([
      app.request(`/${category.uuid}`, { method: "DELETE" }),
      conflictApp.request(`/${category.uuid}`, { method: "DELETE" }),
    ]);

    expect(deleted.status).toBe(200);
    await expect(deleted.json()).resolves.toEqual({
      data: { uuid: category.uuid },
    });
    expect(conflict.status).toBe(409);
    await expect(conflict.json()).resolves.toEqual({
      error: {
        code: "CATEGORY_HAS_ASSOCIATED_PRODUCTS",
        message: "Category has associated products.",
      },
    });
  });

  it("returns 400 for empty updates and invalid list queries", async () => {
    const app = createCategoryRoutes({ service: createService() });

    const [emptyUpdate, invalidQuery] = await Promise.all([
      app.request(`/${category.uuid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ignored: true }),
      }),
      app.request("/?limit=101"),
    ]);

    expect(emptyUpdate.status).toBe(400);
    expect(invalidQuery.status).toBe(400);
  });
});
