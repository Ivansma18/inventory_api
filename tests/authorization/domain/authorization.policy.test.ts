import { describe, expect, it } from "vitest";

import {
  authorizationPermissions,
  authorizationRoles,
  hasPermission,
  type AuthorizationPermission,
  type UserRole,
} from "../../../src/features/authorization/domain/authorization.policy.js";

const expectedPermissions: Record<
  UserRole,
  readonly AuthorizationPermission[]
> = {
  ADMIN: authorizationPermissions,
  MANAGER: [
    "product:create",
    "product:update",
    "product:deactivate",
    "category:create",
    "category:update",
    "category:deactivate",
    "category:delete",
    "inventory:minimum-stock:update",
    "stock-movement:entry",
    "stock-movement:exit",
    "stock-movement:adjust",
  ],
  OPERATOR: [
    "stock-movement:entry",
    "stock-movement:exit",
    "stock-movement:adjust",
  ],
  VIEWER: [],
};

describe("Authorization policy", () => {
  it("recognizes only the four roles defined by the specification", () => {
    expect(authorizationRoles).toEqual([
      "ADMIN",
      "MANAGER",
      "OPERATOR",
      "VIEWER",
    ]);
  });

  it("matches the complete role-permission matrix", () => {
    for (const role of authorizationRoles) {
      for (const permission of authorizationPermissions) {
        expect(
          hasPermission(role, permission),
          `${role} should${expectedPermissions[role].includes(permission) ? "" : " not"} have ${permission}`,
        ).toBe(expectedPermissions[role].includes(permission));
      }
    }
  });
});
