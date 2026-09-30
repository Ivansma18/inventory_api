import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { app } from "../../../src/app.js";

function jsonRequest(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}

describe("Authorization phase HTTP contract", () => {
  it("documents session security and 401/403 on every protected operation", async () => {
    const response = await app.request("/openapi.json");
    expect(response.status).toBe(200);
    const document = await response.json();

    expect(document.components.securitySchemes.sessionCookie).toMatchObject({
      type: "apiKey",
      in: "cookie",
      name: "better-auth.session_token",
    });

    const protectedOperations = [
      ["/products", "post"],
      ["/products/{uuid}", "patch"],
      ["/products/{uuid}", "delete"],
      ["/categories", "post"],
      ["/categories/{uuid}", "patch"],
      ["/categories/{uuid}", "delete"],
      ["/inventory/{productUuid}/minimum-stock", "patch"],
      ["/inventory/{productUuid}/entries", "post"],
      ["/inventory/{productUuid}/exits", "post"],
      ["/inventory/{productUuid}/adjustments", "post"],
      ["/users", "get"],
      ["/users/{id}/role", "patch"],
    ];

    for (const [path, method] of protectedOperations) {
      expect(document.paths[path][method]).toMatchObject({
        security: [{ sessionCookie: [] }],
        responses: {
          401: expect.anything(),
          403: expect.anything(),
        },
      });
    }
  });

  it("keeps business reads and Spec 005 authentication operations public", async () => {
    const response = await app.request("/openapi.json");
    expect(response.status).toBe(200);
    const document = await response.json();

    const publicReads = [
      ["/products", "get"],
      ["/products/{uuid}", "get"],
      ["/categories", "get"],
      ["/categories/{uuid}", "get"],
      ["/inventory", "get"],
      ["/inventory/{productUuid}", "get"],
      ["/inventory/{productUuid}/movements", "get"],
      ["/stock-movements", "get"],
    ];
    for (const [path, method] of publicReads) {
      expect(document.paths[path][method].security).toBeUndefined();
      expect(document.paths[path][method].responses).not.toHaveProperty("401");
      expect(document.paths[path][method].responses).not.toHaveProperty("403");
    }

    const authenticationOperations = [
      ["/api/auth/sign-up/email", "post", [201, 400, 409]],
      ["/api/auth/sign-in/email", "post", [200, 400, 401]],
      ["/api/auth/get-session", "get", [200, 401]],
      ["/api/auth/sign-out", "post", [204]],
    ] as const;
    for (const [path, method, responseCodes] of authenticationOperations) {
      const operation = document.paths[path][method];
      expect(operation.security).toBeUndefined();
      for (const status of responseCodes) {
        expect(operation.responses[status]).toBeDefined();
      }
    }
  });

  it("keeps public reads accessible without a session and protects every write", async () => {
    const productUuid = randomUUID();
    const categoryUuid = randomUUID();
    const requests: Array<[string, RequestInit?]> = [
      ["/products"],
      [`/products/${productUuid}`],
      ["/categories"],
      [`/categories/${categoryUuid}`],
      ["/inventory"],
      [`/inventory/${productUuid}`],
      [`/inventory/${productUuid}/movements`],
      ["/stock-movements"],
      [
        "/products",
        jsonRequest("POST", {
          sku: `PUBLIC-${randomUUID()}`,
          name: "Product",
          purchasePrice: 10,
          salePrice: 20,
          categoryUuid,
        }),
      ],
      [`/products/${productUuid}`, jsonRequest("PATCH", { name: "Updated" })],
      [`/products/${productUuid}`, { method: "DELETE" }],
      [
        "/categories",
        jsonRequest("POST", { name: `Category ${randomUUID()}` }),
      ],
      [
        `/categories/${categoryUuid}`,
        jsonRequest("PATCH", { name: "Updated" }),
      ],
      [`/categories/${categoryUuid}`, { method: "DELETE" }],
      [
        `/inventory/${productUuid}/minimum-stock`,
        jsonRequest("PATCH", { minimumStock: 5 }),
      ],
      [
        `/inventory/${productUuid}/entries`,
        jsonRequest("POST", { quantity: 1 }),
      ],
      [`/inventory/${productUuid}/exits`, jsonRequest("POST", { quantity: 1 })],
      [
        `/inventory/${productUuid}/adjustments`,
        jsonRequest("POST", { quantity: 1, reason: "Count" }),
      ],
      ["/users"],
      [
        `/users/${randomUUID()}/role`,
        jsonRequest("PATCH", { role: "MANAGER" }),
      ],
    ];

    const responses = await Promise.all(
      requests.map(([path, init]) =>
        app.request(path, init ?? { method: "GET" }),
      ),
    );
    const readResponses = responses.slice(0, 8);
    const writeResponses = responses.slice(8);

    expect(readResponses.map(({ status }) => status)).toEqual([
      200, 404, 200, 404, 200, 404, 404, 200,
    ]);
    expect(writeResponses.map(({ status }) => status)).toEqual(
      writeResponses.map(() => 401),
    );
    for (const response of writeResponses) {
      await expect(response.json()).resolves.toMatchObject({
        error: { code: "UNAUTHORIZED" },
      });
    }
  });
});
