import { describe, expect, it } from "vitest";

import { app } from "../src/app.js";

describe("GET /health", () => {
  it("returns the service status", async () => {
    const response = await app.request("/health");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "ok" });
  });

  it("publishes the OpenAPI document and Swagger UI", async () => {
    const [
      openApiResponse,
      docsResponse,
      productsResponse,
      categoriesResponse,
      inventoryResponse,
      missingProductResponse,
      stockMovementsResponse,
      invalidMovementHistoryResponse,
    ] = await Promise.all([
      app.request("/openapi.json"),
      app.request("/docs"),
      app.request("/products"),
      app.request("/categories"),
      app.request("/inventory"),
      app.request("/products/550e8400-e29b-41d4-a716-446655440099"),
      app.request("/stock-movements"),
      app.request("/inventory/not-a-uuid/movements"),
    ]);

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
        "/categories": {
          get: expect.anything(),
          post: expect.anything(),
        },
        "/categories/{uuid}": {
          get: expect.anything(),
          patch: expect.anything(),
          delete: expect.anything(),
        },
        "/inventory": {
          get: expect.anything(),
        },
        "/inventory/{productUuid}": {
          get: expect.anything(),
        },
        "/inventory/{productUuid}/minimum-stock": {
          patch: expect.anything(),
        },
        "/inventory/{productUuid}/entries": {
          post: expect.anything(),
        },
        "/inventory/{productUuid}/exits": {
          post: expect.anything(),
        },
        "/inventory/{productUuid}/adjustments": {
          post: expect.anything(),
        },
        "/inventory/{productUuid}/movements": {
          get: expect.anything(),
        },
        "/stock-movements": {
          get: expect.anything(),
        },
      },
    });
    expect(
      openApiDocument.paths["/inventory/{productUuid}/quantity"],
    ).toBeUndefined();
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
    expect(categoriesResponse.status).toBe(200);
    expect(inventoryResponse.status).toBe(200);
    expect(missingProductResponse.status).toBe(404);
    expect(stockMovementsResponse.status).toBe(200);
    expect(invalidMovementHistoryResponse.status).toBe(400);
    await expect(productsResponse.json()).resolves.toMatchObject({
      data: expect.any(Array),
      pagination: { page: 1, limit: 15 },
    });
    await expect(categoriesResponse.json()).resolves.toMatchObject({
      data: expect.any(Array),
      pagination: { page: 1, limit: 15 },
    });
    await expect(inventoryResponse.json()).resolves.toMatchObject({
      data: expect.any(Array),
      pagination: { page: 1, limit: 15 },
    });
    await expect(stockMovementsResponse.json()).resolves.toMatchObject({
      data: expect.any(Array),
      pagination: { page: 1, limit: 15 },
    });
  });
});
