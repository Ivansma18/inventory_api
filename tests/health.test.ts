import { describe, expect, it } from "vitest";

import { app } from "../src/app.js";

describe("GET /health", () => {
  it("returns the service status", async () => {
    const response = await app.request("/health");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "ok" });
  });

  it("publishes the OpenAPI document and Swagger UI", async () => {
    const [openApiResponse, docsResponse] = await Promise.all([
      app.request("/openapi.json"),
      app.request("/docs"),
    ]);

    expect(openApiResponse.status).toBe(200);
    await expect(openApiResponse.json()).resolves.toMatchObject({
      paths: {
        "/health": expect.anything(),
      },
    });
    expect(docsResponse.status).toBe(200);
  });
});
