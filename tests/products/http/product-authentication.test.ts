import { randomUUID } from "node:crypto";

import { Hono } from "hono";
import { afterEach, describe, expect, it } from "vitest";

import { app } from "../../../src/app.js";
import { createAuthRoutes } from "../../../src/features/auth/http/auth.routes.js";
import { prisma } from "../../../src/shared/database/prisma.js";

const authRoutes = new Hono().route("/api/auth", createAuthRoutes());

let createdUserIds: string[] = [];
let createdProductUuids: string[] = [];
let createdCategoryUuids: string[] = [];

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

  createdUserIds = [];
  createdProductUuids = [];
  createdCategoryUuids = [];
});

async function createSessionCookie(): Promise<string> {
  const email = `${randomUUID()}@example.com`;
  const response = await authRoutes.request("/api/auth/sign-up/email", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: "Product auth user",
      email,
      password: "valid-password-123",
    }),
  });
  const body = await response.json();
  createdUserIds.push(body.data.user.id);

  return response.headers.get("set-cookie")!.split(";")[0];
}

describe("Product route authentication", () => {
  it("rejects product writes without a session while keeping reads public", async () => {
    const [createResponse, updateResponse, deleteResponse, listResponse] =
      await Promise.all([
        app.request("/products", { method: "POST" }),
        app.request(`/products/${randomUUID()}`, { method: "PATCH" }),
        app.request(`/products/${randomUUID()}`, { method: "DELETE" }),
        app.request("/products"),
      ]);

    for (const response of [createResponse, updateResponse, deleteResponse]) {
      expect(response.status).toBe(401);
      await expect(response.json()).resolves.toMatchObject({
        error: { code: "UNAUTHORIZED" },
      });
    }
    expect(listResponse.status).toBe(200);
  });

  it("allows authenticated writes and logically deactivates a product", async () => {
    const categoryUuid = randomUUID();
    createdCategoryUuids.push(categoryUuid);
    await prisma.category.create({
      data: {
        uuid: categoryUuid,
        name: `Product auth category ${categoryUuid}`,
        nameNormalized: `product-auth-category-${categoryUuid}`,
      },
    });

    const cookie = await createSessionCookie();
    const suffix = randomUUID();
    const createResponse = await app.request("/products", {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({
        sku: `AUTH-${suffix}`,
        name: "Protected product",
        purchasePrice: 100,
        salePrice: 150,
        categoryUuid,
      }),
    });
    expect(createResponse.status).toBe(201);
    const created = await createResponse.json();
    const productUuid = created.data.uuid as string;
    createdProductUuids.push(productUuid);

    const updateResponse = await app.request(`/products/${productUuid}`, {
      method: "PATCH",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ name: "Updated protected product" }),
    });
    expect(updateResponse.status).toBe(200);

    const deleteResponse = await app.request(`/products/${productUuid}`, {
      method: "DELETE",
      headers: { cookie },
    });
    expect(deleteResponse.status).toBe(200);
    await expect(deleteResponse.json()).resolves.toEqual({
      data: { uuid: productUuid, isActive: false },
    });

    await expect(
      prisma.product.findUnique({
        where: { uuid: productUuid },
        select: { isActive: true },
      }),
    ).resolves.toEqual({ isActive: false });
  });
});
