import { OpenAPIHono } from "@hono/zod-openapi";
import { createMiddleware } from "hono/factory";
import type { MiddlewareHandler } from "hono";
import { describe, expect, it } from "vitest";

import { app as apiApp } from "../../../src/app.js";
import type { AuthMiddlewareEnv } from "../../../src/shared/middlewares/auth.middleware.js";
import { createProduct } from "../../../src/features/products/domain/product.entity.js";
import {
  createProductRoutes,
  type ProductHttpService,
} from "../../../src/features/products/http/product.routes.js";
import type { UserRole } from "../../../src/features/authorization/index.js";

const product = createProduct({
  uuid: "550e8400-e29b-41d4-a716-446655440000",
  sku: "DESK-001",
  name: "Standing desk",
  description: null,
  purchasePrice: 100,
  salePrice: 150,
  categoryUuid: "550e8400-e29b-41d4-a716-446655440001",
  createdAt: new Date("2026-09-23T10:00:00.000Z"),
  updatedAt: new Date("2026-09-23T10:00:00.000Z"),
});

const productInput = {
  sku: "DESK-001",
  name: "Standing desk",
  purchasePrice: 100,
  salePrice: 150,
  categoryUuid: product.categoryUuid,
};

function createService(calls: string[] = []): ProductHttpService {
  return {
    async createProduct() {
      calls.push("create");
      return product;
    },
    async getProduct() {
      return product;
    },
    async listProducts() {
      return { products: [product], total: 1 };
    },
    async updateProduct() {
      calls.push("update");
      return product;
    },
    async deleteProduct() {
      calls.push("deactivate");
      return { ...product, isActive: false };
    },
  };
}

function createTestAuthMiddleware(
  role: UserRole | undefined,
): MiddlewareHandler<AuthMiddlewareEnv> {
  return createMiddleware<AuthMiddlewareEnv>(async (context, next) => {
    if (!role) {
      return context.json(
        {
          error: {
            code: "UNAUTHORIZED",
            message: "Authentication required",
          },
        },
        401,
      );
    }

    context.set("auth", {
      id: "product-permission-test-user",
      email: "product-permission@example.com",
      role,
    });
    await next();
  });
}

function createTestApp(role: UserRole | undefined, calls: string[] = []) {
  return createProductRoutes({
    service: createService(calls),
    authMiddleware: createTestAuthMiddleware(role),
  });
}

async function performProductWrites(
  testApp: OpenAPIHono<AuthMiddlewareEnv>,
): Promise<Response[]> {
  return Promise.all([
    testApp.request("/", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(productInput),
    }),
    testApp.request(`/${product.uuid}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Updated desk" }),
    }),
    testApp.request(`/${product.uuid}`, { method: "DELETE" }),
  ]);
}

describe("Product authorization", () => {
  it("allows ADMIN and MANAGER to create, update, and deactivate products", async () => {
    for (const role of ["ADMIN", "MANAGER"] as const) {
      const calls: string[] = [];
      const responses = await performProductWrites(createTestApp(role, calls));

      expect(responses.map(({ status }) => status)).toEqual([201, 200, 200]);
      expect(calls.sort()).toEqual(["create", "deactivate", "update"]);
    }
  });

  it("returns 403 for OPERATOR and VIEWER on all product writes", async () => {
    for (const role of ["OPERATOR", "VIEWER"] as const) {
      const calls: string[] = [];
      const responses = await performProductWrites(createTestApp(role, calls));

      expect(responses.map(({ status }) => status)).toEqual([403, 403, 403]);
      for (const response of responses) {
        await expect(response.json()).resolves.toEqual({
          error: {
            code: "FORBIDDEN",
            message: "You do not have permission to perform this operation.",
          },
        });
      }
      expect(calls).toEqual([]);
    }
  });

  it("returns 401 without a session and keeps product reads public", async () => {
    const calls: string[] = [];
    const testApp = createTestApp(undefined, calls);
    const [create, update, deactivate] = await performProductWrites(testApp);
    const [list, get] = await Promise.all([
      testApp.request("/"),
      testApp.request(`/${product.uuid}`),
    ]);

    expect([create.status, update.status, deactivate.status]).toEqual([
      401, 401, 401,
    ]);
    expect(list.status).toBe(200);
    expect(get.status).toBe(200);
    expect(calls).toEqual([]);
  });

  it("documents sessionCookie, 401, and 403 on product writes only", async () => {
    const response = await apiApp.request("/openapi.json");
    expect(response.status).toBe(200);
    const document = await response.json();

    for (const [path, method] of [
      ["/products", "post"],
      ["/products/{uuid}", "patch"],
      ["/products/{uuid}", "delete"],
    ]) {
      expect(document.paths[path][method]).toMatchObject({
        security: [{ sessionCookie: [] }],
        responses: {
          401: expect.anything(),
          403: expect.anything(),
        },
      });
    }
    expect(document.paths["/products"].get.security).toBeUndefined();
    expect(document.paths["/products/{uuid}"].get.security).toBeUndefined();
  });
});
