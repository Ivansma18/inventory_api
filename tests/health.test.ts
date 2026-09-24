import { describe, expect, it } from "vitest";

import { app } from "../src/app.js";

describe("GET /health", () => {
  it("returns the service status", async () => {
    const response = await app.request("/health");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "ok" });
  });

  it("publishes the OpenAPI document and Swagger UI", async () => {
    const [openApiResponse, docsResponse, productsResponse] = await Promise.all(
      [
        app.request("/openapi.json"),
        app.request("/docs"),
        app.request("/products"),
      ],
    );

    expect(openApiResponse.status).toBe(200);
    const openApiDocument = await openApiResponse.json();

    expect(openApiDocument).toMatchObject({
      paths: {
        "/health": expect.anything(),
        "/products": {
          get: expect.anything(),
          post: expect.anything(),
        },
        "/products/{uuid}": {
          get: expect.anything(),
          patch: expect.anything(),
        },
      },
    });
    expect(openApiDocument.components.schemas.CreateProduct).toMatchObject({
      required: expect.arrayContaining(["categoryUuid"]),
      properties: {
        categoryUuid: { type: "string", format: "uuid" },
      },
    });
    expect(openApiDocument.components.schemas.UpdateProduct).toMatchObject({
      properties: {
        categoryUuid: { type: "string", format: "uuid" },
      },
    });
    expect(openApiDocument.components.schemas.Product).toMatchObject({
      properties: {
        categoryUuid: { type: "string", format: "uuid", nullable: true },
      },
    });
    expect(docsResponse.status).toBe(200);
    expect(productsResponse.status).toBe(200);
    await expect(productsResponse.json()).resolves.toMatchObject({
      data: expect.any(Array),
      pagination: { page: 1, limit: 15 },
    });
  });
});
