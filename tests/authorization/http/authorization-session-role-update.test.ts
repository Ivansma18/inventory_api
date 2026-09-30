import { randomUUID } from "node:crypto";

import { afterEach, describe, expect, it } from "vitest";

import { app } from "../../../src/app.js";
import { prisma } from "../../../src/shared/database/prisma.js";

const password = "valid-password-123";
const createdUserIds: string[] = [];
const createdCategoryUuids: string[] = [];
const createdProductUuids: string[] = [];

afterEach(async () => {
  const products = await prisma.product.findMany({
    where: {
      OR: [
        { uuid: { in: createdProductUuids } },
        { category: { uuid: { in: createdCategoryUuids } } },
      ],
    },
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

async function signUp(email: string, name: string) {
  const response = await app.request("/api/auth/sign-up/email", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name, email, password }),
  });

  expect(response.status).toBe(201);
  const body = (await response.json()) as {
    data: { user: { id: string; role: string } };
  };
  createdUserIds.push(body.data.user.id);

  return {
    userId: body.data.user.id,
    cookie: response.headers.get("set-cookie")!.split(";")[0]!,
  };
}

async function signIn(email: string): Promise<string> {
  const response = await app.request("/api/auth/sign-in/email", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  expect(response.status).toBe(200);
  return response.headers.get("set-cookie")!.split(";")[0]!;
}

async function getSession(cookie: string) {
  const response = await app.request("/api/auth/get-session", {
    headers: { cookie },
  });

  expect(response.status).toBe(200);
  return response.json();
}

function productBody(sku: string, categoryUuid: string) {
  return JSON.stringify({
    sku,
    name: "Role-updated product",
    purchasePrice: 10,
    salePrice: 20,
    categoryUuid,
  });
}

describe("Authorization role freshness across active sessions", () => {
  it("applies a role update to every active session on its next request", async () => {
    const adminEmail = `${randomUUID()}@example.com`;
    const administrator = await signUp(adminEmail, "Manual administrator");
    await prisma.user.update({
      where: { id: administrator.userId },
      data: { role: "ADMIN" },
    });

    const targetEmail = `${randomUUID()}@example.com`;
    const targetUser = await signUp(targetEmail, "Multi-session user");
    const sessionCookies = [
      targetUser.cookie,
      await signIn(targetEmail),
      await signIn(targetEmail),
    ];
    const initialSessions = await Promise.all(
      sessionCookies.map((cookie) => getSession(cookie)),
    );
    const sessionIds = initialSessions.map(
      (session) => session.data.session.id,
    );

    expect(new Set(sessionIds).size).toBe(sessionCookies.length);
    expect(initialSessions.map((session) => session.data.user.role)).toEqual([
      "VIEWER",
      "VIEWER",
      "VIEWER",
    ]);

    const categoryUuid = randomUUID();
    const categoryName = `Session role category ${categoryUuid}`;
    createdCategoryUuids.push(categoryUuid);
    await prisma.category.create({
      data: {
        uuid: categoryUuid,
        name: categoryName,
        nameNormalized: categoryName.toLowerCase(),
      },
    });

    const deniedCreates = await Promise.all(
      sessionCookies.map((cookie, index) =>
        app.request("/products", {
          method: "POST",
          headers: { cookie, "content-type": "application/json" },
          body: productBody(`VIEWER-${index}-${randomUUID()}`, categoryUuid),
        }),
      ),
    );
    expect(deniedCreates.map(({ status }) => status)).toEqual([403, 403, 403]);

    const roleUpdate = await app.request(`/users/${targetUser.userId}/role`, {
      method: "PATCH",
      headers: {
        cookie: administrator.cookie,
        "content-type": "application/json",
      },
      body: JSON.stringify({ role: "MANAGER" }),
    });
    expect(roleUpdate.status).toBe(200);
    await expect(roleUpdate.json()).resolves.toMatchObject({
      data: { id: targetUser.userId, role: "MANAGER" },
    });

    const updatedSessions = await Promise.all(
      sessionCookies.map((cookie) => getSession(cookie)),
    );
    expect(updatedSessions.map((session) => session.data.user.role)).toEqual([
      "MANAGER",
      "MANAGER",
      "MANAGER",
    ]);

    const allowedCreates: Response[] = [];
    for (const [index, cookie] of sessionCookies.entries()) {
      allowedCreates.push(
        await app.request("/products", {
          method: "POST",
          headers: { cookie, "content-type": "application/json" },
          body: productBody(`MANAGER-${index}-${randomUUID()}`, categoryUuid),
        }),
      );
    }
    expect(allowedCreates.map(({ status }) => status)).toEqual([201, 201, 201]);

    for (const response of allowedCreates) {
      const body = await response.json();
      createdProductUuids.push(body.data.uuid);
    }
  });
});
