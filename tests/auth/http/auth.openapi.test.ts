import { describe, expect, it } from "vitest";

import { app } from "../../../src/app.js";

describe("Authentication OpenAPI contract", () => {
  it("mounts the public authentication handler in the application", async () => {
    const [sessionResponse, signOutResponse] = await Promise.all([
      app.request("/api/auth/get-session"),
      app.request("/api/auth/sign-out", { method: "POST" }),
    ]);

    expect(sessionResponse.status).toBe(401);
    await expect(sessionResponse.json()).resolves.toEqual({
      error: { code: "UNAUTHORIZED", message: "Authentication required" },
    });
    expect(signOutResponse.status).toBe(204);
  });

  it("documents public authentication operations without session secrets", async () => {
    const response = await app.request("/openapi.json");

    expect(response.status).toBe(200);
    const document = await response.json();

    expect(document.paths).toMatchObject({
      "/api/auth/sign-up/email": { post: expect.anything() },
      "/api/auth/sign-in/email": { post: expect.anything() },
      "/api/auth/get-session": { get: expect.anything() },
      "/api/auth/sign-out": { post: expect.anything() },
    });
    expect(
      document.paths["/api/auth/sign-up/email"].post.responses,
    ).toMatchObject({
      201: expect.anything(),
      400: expect.anything(),
      409: expect.anything(),
    });
    expect(
      document.paths["/api/auth/sign-in/email"].post.responses,
    ).toMatchObject({
      200: expect.anything(),
      400: expect.anything(),
      401: expect.anything(),
    });
    expect(document.paths["/api/auth/get-session"].get.responses).toMatchObject(
      {
        200: expect.anything(),
        401: expect.anything(),
      },
    );
    expect(document.paths["/api/auth/sign-out"].post.responses).toMatchObject({
      204: expect.anything(),
    });
    expect(document.components.schemas.AuthRegistration).toMatchObject({
      required: ["name", "email", "password"],
      properties: {
        name: { type: "string" },
        email: { type: "string", format: "email" },
        password: { type: "string", minLength: 8 },
      },
    });
    expect(document.components.schemas.AuthCredentials).toMatchObject({
      required: ["email", "password"],
      properties: {
        email: { type: "string", format: "email" },
        password: { type: "string", minLength: 8 },
      },
    });

    const responseSchema = document.components.schemas.PublicAuthResponse;
    expect(responseSchema).toMatchObject({
      properties: {
        data: {
          properties: {
            user: { $ref: "#/components/schemas/PublicAuthUser" },
            session: { $ref: "#/components/schemas/PublicAuthSession" },
          },
        },
      },
    });
    expect(document.components.schemas.PublicAuthUser).toMatchObject({
      properties: {
        id: expect.anything(),
        email: expect.anything(),
        role: {
          type: "string",
          enum: ["ADMIN", "MANAGER", "OPERATOR", "VIEWER"],
        },
      },
    });
    expect(document.components.schemas.PublicAuthSession).toMatchObject({
      properties: { id: expect.anything(), createdAt: expect.anything() },
    });
    expect(
      JSON.stringify({
        response: responseSchema,
        user: document.components.schemas.PublicAuthUser,
        session: document.components.schemas.PublicAuthSession,
      }),
    ).not.toMatch(/password|token|secret|expiresAt/i);
  });
});
