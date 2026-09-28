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
  const response = await authRoutes.request("/api/auth/sign-up/email", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: "Stock movement auth user",
      email: `${randomUUID()}@example.com`,
      password: "valid-password-123",
    }),
  });
  const body = await response.json();
  createdUserIds.push(body.data.user.id);

  return response.headers.get("set-cookie")!.split(";")[0];
}

async function createProductWithInventory(): Promise<string> {
  const suffix = randomUUID();
  const categoryUuid = randomUUID();
  createdCategoryUuids.push(categoryUuid);
  const category = await prisma.category.create({
    data: {
      uuid: categoryUuid,
      name: `Stock movement category ${suffix}`,
      nameNormalized: `stock-movement-category-${suffix}`,
    },
  });
  const productUuid = randomUUID();
  createdProductUuids.push(productUuid);
  await prisma.product.create({
    data: {
      uuid: productUuid,
      sku: `MOVEMENT-${suffix}`,
      skuNormalized: `movement-${suffix}`,
      name: "Stock movement product",
      purchasePrice: 100,
      salePrice: 150,
      categoryId: category.id,
      inventory: { create: {} },
    },
  });

  return productUuid;
}

describe("Stock movement route authentication", () => {
  it("rejects movement writes without a session while keeping inventory and movement queries public", async () => {
    const productUuid = await createProductWithInventory();
    const [entry, exit, adjustment, inventory, productMovements, movements] =
      await Promise.all([
        app.request(`/inventory/${productUuid}/entries`, { method: "POST" }),
        app.request(`/inventory/${productUuid}/exits`, { method: "POST" }),
        app.request(`/inventory/${productUuid}/adjustments`, {
          method: "POST",
        }),
        app.request(`/inventory/${productUuid}`),
        app.request(`/inventory/${productUuid}/movements`),
        app.request("/stock-movements"),
      ]);

    for (const response of [entry, exit, adjustment]) {
      expect(response.status).toBe(401);
      await expect(response.json()).resolves.toEqual({
        error: {
          code: "UNAUTHORIZED",
          message: "Authentication required",
        },
      });
    }
    for (const response of [inventory, productMovements, movements]) {
      expect(response.status).toBe(200);
    }
  });

  it("allows authenticated entries, exits, and adjustments", async () => {
    const productUuid = await createProductWithInventory();
    const cookie = await createSessionCookie();
    const headers = { cookie, "content-type": "application/json" };

    const entry = await app.request(`/inventory/${productUuid}/entries`, {
      method: "POST",
      headers,
      body: JSON.stringify({ quantity: 5 }),
    });
    const exit = await app.request(`/inventory/${productUuid}/exits`, {
      method: "POST",
      headers,
      body: JSON.stringify({ quantity: 2 }),
    });
    const adjustment = await app.request(
      `/inventory/${productUuid}/adjustments`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({ quantity: 10, reason: "Inventory count" }),
      },
    );

    for (const response of [entry, exit, adjustment]) {
      expect(response.status).toBe(201);
    }
    await expect(
      prisma.inventory.findFirst({
        where: { product: { uuid: productUuid } },
        select: { quantity: true },
      }),
    ).resolves.toEqual({ quantity: 10 });
  });
});
