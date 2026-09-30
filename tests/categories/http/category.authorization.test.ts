import { randomUUID } from "node:crypto";

import { afterEach, describe, expect, it } from "vitest";

import { app } from "../../../src/app.js";
import type { UserRole } from "../../../src/features/authorization/index.js";
import { prisma } from "../../../src/shared/database/prisma.js";

const createdUserIds: string[] = [];
const createdCategoryUuids: string[] = [];
const createdProductUuids: string[] = [];

afterEach(async () => {
  const products = await prisma.product.findMany({
    where: { uuid: { in: createdProductUuids } },
    select: { id: true },
  });
  const productIds = products.map(({ id }) => id);

  await prisma.stockMovement.deleteMany({
    where: { productId: { in: productIds } },
  });
  await prisma.inventory.deleteMany({
    where: { productId: { in: productIds } },
  });
  await prisma.product.deleteMany({ where: { id: { in: productIds } } });
  await prisma.category.deleteMany({
    where: { uuid: { in: createdCategoryUuids } },
  });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });

  createdUserIds.length = 0;
  createdCategoryUuids.length = 0;
  createdProductUuids.length = 0;
});

async function createSessionCookie(role: UserRole): Promise<string> {
  const email = `${randomUUID()}@example.com`;
  const response = await app.request("/api/auth/sign-up/email", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: "Category authorization user",
      email,
      password: "valid-password-123",
    }),
  });

  expect(response.status).toBe(201);
  const body = (await response.json()) as { data: { user: { id: string } } };
  createdUserIds.push(body.data.user.id);
  await prisma.user.update({
    where: { id: body.data.user.id },
    data: { role },
  });

  return response.headers.get("set-cookie")!.split(";")[0]!;
}

async function createCategoryFixture() {
  const uuid = randomUUID();
  const name = `Authorization category ${uuid}`;
  const category = await prisma.category.create({
    data: {
      uuid,
      name,
      nameNormalized: name.toLowerCase(),
    },
  });
  createdCategoryUuids.push(category.uuid);

  return category;
}

async function createAssociatedProduct(categoryUuid: string): Promise<void> {
  const category = await prisma.category.findUniqueOrThrow({
    where: { uuid: categoryUuid },
    select: { id: true },
  });
  const uuid = randomUUID();

  await prisma.product.create({
    data: {
      uuid,
      sku: `CATEGORY-${uuid}`,
      skuNormalized: `category-${uuid}`,
      name: "Category authorization product",
      purchasePrice: 10,
      salePrice: 20,
      categoryId: category.id,
    },
  });
  createdProductUuids.push(uuid);
}

async function trackUnexpectedCategoryCreation(
  response: Response,
): Promise<void> {
  if (response.status !== 201) {
    return;
  }

  const body = (await response.clone().json()) as {
    data?: { uuid?: unknown };
  };
  if (typeof body.data?.uuid === "string") {
    createdCategoryUuids.push(body.data.uuid);
  }
}

describe("Category authorization", () => {
  it("allows ADMIN and MANAGER to create, update, deactivate, and delete unused categories", async () => {
    for (const role of ["ADMIN", "MANAGER"] as const) {
      const cookie = await createSessionCookie(role);
      const suffix = randomUUID();
      const createResponse = await app.request("/categories", {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ name: `Category ${suffix}` }),
      });

      expect(createResponse.status).toBe(201);
      const created = await createResponse.json();
      const categoryUuid = created.data.uuid as string;
      createdCategoryUuids.push(categoryUuid);

      const updateResponse = await app.request(`/categories/${categoryUuid}`, {
        method: "PATCH",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({
          name: `Updated category ${suffix}`,
          isActive: false,
        }),
      });
      expect(updateResponse.status).toBe(200);

      const deleteResponse = await app.request(`/categories/${categoryUuid}`, {
        method: "DELETE",
        headers: { cookie },
      });
      expect(deleteResponse.status).toBe(200);
      await expect(deleteResponse.json()).resolves.toEqual({
        data: { uuid: categoryUuid },
      });
      await expect(
        prisma.category.findUnique({ where: { uuid: categoryUuid } }),
      ).resolves.toBeNull();
    }
  });

  it("returns 401 for unauthenticated writes while keeping reads public", async () => {
    const category = await createCategoryFixture();
    const suffix = randomUUID();
    const [create, update, remove, list, get] = await Promise.all([
      app.request("/categories", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: `Unauthenticated category ${suffix}` }),
      }),
      app.request(`/categories/${category.uuid}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: `Updated ${suffix}` }),
      }),
      app.request(`/categories/${category.uuid}`, { method: "DELETE" }),
      app.request("/categories"),
      app.request(`/categories/${category.uuid}`),
    ]);
    await trackUnexpectedCategoryCreation(create);

    for (const response of [create, update, remove]) {
      expect(response.status).toBe(401);
      await expect(response.json()).resolves.toMatchObject({
        error: { code: "UNAUTHORIZED" },
      });
    }
    expect(list.status).toBe(200);
    expect(get.status).toBe(200);
  });

  it("returns 403 for OPERATOR and VIEWER on all category writes", async () => {
    for (const role of ["OPERATOR", "VIEWER"] as const) {
      const cookie = await createSessionCookie(role);
      const category = await createCategoryFixture();
      const suffix = randomUUID();
      const responses = await Promise.all([
        app.request("/categories", {
          method: "POST",
          headers: { cookie, "content-type": "application/json" },
          body: JSON.stringify({ name: `Forbidden category ${suffix}` }),
        }),
        app.request(`/categories/${category.uuid}`, {
          method: "PATCH",
          headers: { cookie, "content-type": "application/json" },
          body: JSON.stringify({ name: `Forbidden update ${suffix}` }),
        }),
        app.request(`/categories/${category.uuid}`, {
          method: "DELETE",
          headers: { cookie },
        }),
      ]);
      await trackUnexpectedCategoryCreation(responses[0]!);

      expect(responses.map(({ status }) => status)).toEqual([403, 403, 403]);
      for (const response of responses) {
        await expect(response.json()).resolves.toMatchObject({
          error: { code: "FORBIDDEN" },
        });
      }
      await expect(
        prisma.category.findUnique({ where: { uuid: category.uuid } }),
      ).resolves.toMatchObject({ name: category.name });
    }
  });

  it("preserves 409 when a MANAGER tries to delete a category with products", async () => {
    const cookie = await createSessionCookie("MANAGER");
    const category = await createCategoryFixture();
    await createAssociatedProduct(category.uuid);

    const response = await app.request(`/categories/${category.uuid}`, {
      method: "DELETE",
      headers: { cookie },
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "CATEGORY_HAS_ASSOCIATED_PRODUCTS",
        message: "Category has associated products.",
      },
    });
    await expect(
      prisma.category.findUnique({ where: { uuid: category.uuid } }),
    ).resolves.toMatchObject({ uuid: category.uuid });
  });

  it("documents authentication and permission errors for category writes", async () => {
    const response = await app.request("/openapi.json");
    expect(response.status).toBe(200);
    const document = await response.json();

    for (const [path, method] of [
      ["/categories", "post"],
      ["/categories/{uuid}", "patch"],
      ["/categories/{uuid}", "delete"],
    ]) {
      expect(document.paths[path][method]).toMatchObject({
        security: [{ sessionCookie: [] }],
        responses: {
          401: expect.anything(),
          403: expect.anything(),
        },
      });
    }
    expect(document.paths["/categories"].get.security).toBeUndefined();
    expect(document.paths["/categories/{uuid}"].get.security).toBeUndefined();
  });
});
