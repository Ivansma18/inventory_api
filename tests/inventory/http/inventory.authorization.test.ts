import { randomUUID } from "node:crypto";

import { afterEach, describe, expect, it } from "vitest";

import { app } from "../../../src/app.js";
import type { UserRole } from "../../../src/features/authorization/index.js";
import { prisma } from "../../../src/shared/database/prisma.js";

const createdUserIds: string[] = [];
const createdCategoryUuids: string[] = [];
const createdProductUuids: string[] = [];

afterEach(async () => {
  await prisma.stockMovement.deleteMany({
    where: { product: { uuid: { in: createdProductUuids } } },
  });
  await prisma.inventory.deleteMany({
    where: { product: { uuid: { in: createdProductUuids } } },
  });
  await prisma.product.deleteMany({
    where: { uuid: { in: createdProductUuids } },
  });
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
      name: "Inventory authorization user",
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

async function createInventoryFixture() {
  const categoryUuid = randomUUID();
  const categoryName = `Inventory authorization category ${categoryUuid}`;
  createdCategoryUuids.push(categoryUuid);
  const category = await prisma.category.create({
    data: {
      uuid: categoryUuid,
      name: categoryName,
      nameNormalized: categoryName.toLowerCase(),
    },
    select: { id: true },
  });

  const productUuid = randomUUID();
  createdProductUuids.push(productUuid);
  const product = await prisma.product.create({
    data: {
      uuid: productUuid,
      sku: `INVENTORY-${productUuid}`,
      skuNormalized: `inventory-${productUuid}`,
      name: "Inventory authorization product",
      purchasePrice: 10,
      salePrice: 20,
      categoryId: category.id,
    },
    select: { id: true, uuid: true },
  });
  await prisma.inventory.create({
    data: {
      productId: product.id,
      quantity: 5,
      minimumStock: 2,
    },
  });

  return product;
}

describe("Inventory authorization", () => {
  it("allows ADMIN and MANAGER to update minimum stock, denies other roles, and keeps reads public", async () => {
    const product = await createInventoryFixture();
    const unauthenticatedUpdate = await app.request(
      `/inventory/${product.uuid}/minimum-stock`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ minimumStock: 10 }),
      },
    );
    const [publicList, publicItem] = await Promise.all([
      app.request("/inventory"),
      app.request(`/inventory/${product.uuid}`),
    ]);

    expect(unauthenticatedUpdate.status).toBe(401);
    await expect(unauthenticatedUpdate.json()).resolves.toMatchObject({
      error: { code: "UNAUTHORIZED" },
    });
    expect(publicList.status).toBe(200);
    expect(publicItem.status).toBe(200);

    for (const [role, minimumStock] of [
      ["ADMIN", 3],
      ["MANAGER", 4],
    ] as const) {
      const cookie = await createSessionCookie(role);
      const response = await app.request(
        `/inventory/${product.uuid}/minimum-stock`,
        {
          method: "PATCH",
          headers: { cookie, "content-type": "application/json" },
          body: JSON.stringify({ minimumStock }),
        },
      );

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        data: { productUuid: product.uuid, minimumStock },
      });
    }

    for (const role of ["OPERATOR", "VIEWER"] as const) {
      const cookie = await createSessionCookie(role);
      const response = await app.request(
        `/inventory/${product.uuid}/minimum-stock`,
        {
          method: "PATCH",
          headers: { cookie, "content-type": "application/json" },
          body: JSON.stringify({ minimumStock: 10 }),
        },
      );

      expect(response.status).toBe(403);
      await expect(response.json()).resolves.toMatchObject({
        error: { code: "FORBIDDEN" },
      });
    }

    await expect(
      prisma.inventory.findFirst({
        where: { product: { uuid: product.uuid } },
        select: { minimumStock: true },
      }),
    ).resolves.toEqual({ minimumStock: 4 });
  });

  it("documents sessionCookie, 401, and 403 for minimum-stock updates only", async () => {
    const response = await app.request("/openapi.json");
    expect(response.status).toBe(200);
    const document = await response.json();

    expect(
      document.paths["/inventory/{productUuid}/minimum-stock"].patch,
    ).toMatchObject({
      security: [{ sessionCookie: [] }],
      responses: {
        401: expect.anything(),
        403: expect.anything(),
      },
    });
    expect(document.paths["/inventory"].get.security).toBeUndefined();
    expect(
      document.paths["/inventory/{productUuid}"].get.security,
    ).toBeUndefined();
  });
});
