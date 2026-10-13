import { describe, expect, it } from "vitest";

import { createTrustedOrigins } from "../../../src/features/auth/trusted-origins.js";

describe("Better Auth trusted origins", () => {
  it("allows the local frontend in development while preserving the backend origin", () => {
    expect(
      createTrustedOrigins("http://localhost:3000", "development"),
    ).toEqual(["http://localhost:3000", "http://localhost:5174"]);
  });

  it.each(["test", "production"])(
    "does not add the local frontend origin in %s",
    (nodeEnv) => {
      expect(createTrustedOrigins("http://localhost:3000", nodeEnv)).toEqual([
        "http://localhost:3000",
      ]);
    },
  );
});
