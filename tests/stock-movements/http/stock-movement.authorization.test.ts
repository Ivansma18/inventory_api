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
      name: "Stock movement authorization user",
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

async function createProductWithInventory() {
  const categoryUuid = randomUUID();
  const categoryName = `Stock movement authorization category ${categoryUuid}`;
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
      sku: `MOVEMENT-${productUuid}`,
      skuNormalized: `movement-${productUuid}`,
      name: "Stock movement authorization product",
      purchasePrice: 10,
      salePrice: 20,
      categoryId: category.id,
    },
    select: { id: true, uuid: true },
  });
  await prisma.inventory.create({
    data: {
      productId: product.id,
      quantity: 100,
      minimumStock: 10,
    },
  });

  return product;
}

function postJson(body: unknown, cookie?: string): RequestInit {
  return {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  };
}

async function createAllMovementTypes(
  productUuid: string,
  cookie?: string,
): Promise<Response[]> {
  const responses: Response[] = [];
  const requests: Array<[string, RequestInit]> = [
    [
      `/inventory/${productUuid}/entries`,
      postJson({ quantity: 1, reference: `ENTRY-${randomUUID()}` }, cookie),
    ],
    [
      `/inventory/${productUuid}/exits`,
      postJson({ quantity: 1, reference: `EXIT-${randomUUID()}` }, cookie),
    ],
    [
      `/inventory/${productUuid}/adjustments`,
      postJson({ quantity: 80, reason: "Cycle count" }, cookie),
    ],
  ];

  for (const [path, init] of requests) {
    responses.push(await app.request(path, init));
  }

  return responses;
}

describe("Stock movement authorization", () => {
  it("allows ADMIN, MANAGER, and OPERATOR to register each movement type", async () => {
    const product = await createProductWithInventory();

    for (const role of ["ADMIN", "MANAGER", "OPERATOR"] as const) {
      const cookie = await createSessionCookie(role);
      const responses = await createAllMovementTypes(product.uuid, cookie);

      expect(responses.map(({ status }) => status)).toEqual([201, 201, 201]);
    }

    expect(
      await prisma.stockMovement.count({
        where: { product: { uuid: product.uuid } },
      }),
    ).toBe(9);
  });

  it("returns 401 without a session and 403 for VIEWER on all movement writes", async () => {
    const product = await createProductWithInventory();
    const unauthenticatedResponses = await createAllMovementTypes(product.uuid);
    const viewerCookie = await createSessionCookie("VIEWER");
    const viewerResponses = await createAllMovementTypes(
      product.uuid,
      viewerCookie,
    );

    expect(unauthenticatedResponses.map(({ status }) => status)).toEqual([
      401, 401, 401,
    ]);
    expect(viewerResponses.map(({ status }) => status)).toEqual([
      403, 403, 403,
    ]);
    for (const response of [...unauthenticatedResponses, ...viewerResponses]) {
      await expect(response.json()).resolves.toMatchObject({
        error: {
          code: expect.stringMatching(/^(UNAUTHORIZED|FORBIDDEN)$/),
        },
      });
    }
    expect(
      await prisma.stockMovement.count({
        where: { product: { uuid: product.uuid } },
      }),
    ).toBe(0);
  });

  it("keeps movement queries public", async () => {
    const product = await createProductWithInventory();
    const [globalMovements, productMovements] = await Promise.all([
      app.request("/stock-movements"),
      app.request(`/inventory/${product.uuid}/movements`),
    ]);

    expect(globalMovements.status).toBe(200);
    expect(productMovements.status).toBe(200);
  });

  it("documents security and 401/403 for movement writes only", async () => {
    const response = await app.request("/openapi.json");
    expect(response.status).toBe(200);
    const document = await response.json();

    for (const [path, method] of [
      ["/inventory/{productUuid}/entries", "post"],
      ["/inventory/{productUuid}/exits", "post"],
      ["/inventory/{productUuid}/adjustments", "post"],
    ]) {
      expect(document.paths[path][method]).toMatchObject({
        security: [{ sessionCookie: [] }],
        responses: {
          401: expect.anything(),
          403: expect.anything(),
        },
      });
    }
    expect(document.paths["/stock-movements"].get.security).toBeUndefined();
    expect(
      document.paths["/inventory/{productUuid}/movements"].get.security,
    ).toBeUndefined();
  });
});
