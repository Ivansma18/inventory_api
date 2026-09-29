import { describe, expect, it } from "vitest";

import { toAuthResponse } from "../../../src/features/auth/http/auth.mapper.js";

describe("Authentication public mapper", () => {
  it("returns only the public user and session fields", () => {
    const createdAt = new Date("2026-09-25T12:00:00.000Z");

    const response = toAuthResponse(
      {
        id: "user-id",
        email: "user@example.com",
        name: "Private name",
        password: "should-not-be-returned",
        emailVerified: false,
      },
      {
        id: "session-id",
        createdAt,
        updatedAt: createdAt,
        expiresAt: new Date("3026-09-25T12:00:00.000Z"),
        token: "should-not-be-returned",
        userId: "user-id",
        ipAddress: "127.0.0.1",
        userAgent: "test-agent",
      },
    );

    expect(response).toEqual({
      data: {
        user: {
          id: "user-id",
          email: "user@example.com",
        },
        session: {
          id: "session-id",
          createdAt: "2026-09-25T12:00:00.000Z",
        },
      },
    });
    expect(response.data.user).not.toHaveProperty("password");
    expect(response.data.session).not.toHaveProperty("token");
    expect(response.data.session).not.toHaveProperty("expiresAt");
  });
});
