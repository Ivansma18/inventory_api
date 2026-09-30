import { describe, expect, it } from "vitest";

import { AuthorizationService } from "../../../src/features/authorization/application/authorization.service.js";
import {
  AuthorizationUserNotFoundError,
  LastAdminRoleChangeError,
} from "../../../src/features/authorization/domain/authorization.errors.js";
import type {
  AuthorizationRepository,
  AuthorizationUserSummary,
} from "../../../src/features/authorization/domain/authorization.repository.js";
import type { UserRole } from "../../../src/features/authorization/domain/authorization.policy.js";

class AuthorizationRoleSpyRepository implements AuthorizationRepository {
  receivedUserId: string | undefined;
  receivedRole: UserRole | undefined;

  constructor(
    private readonly changeResult: AuthorizationUserSummary | Error,
  ) {}

  async findUsers(): Promise<never> {
    throw new Error("findUsers should not be called");
  }

  async changeUserRole(
    userId: string,
    role: UserRole,
  ): Promise<AuthorizationUserSummary> {
    this.receivedUserId = userId;
    this.receivedRole = role;

    if (this.changeResult instanceof Error) {
      throw this.changeResult;
    }

    return this.changeResult;
  }
}

describe("AuthorizationService.changeUserRole", () => {
  it("passes the user and role to the repository and returns the updated summary", async () => {
    const updatedUser: AuthorizationUserSummary = {
      id: "user-1",
      email: "manager@example.com",
      role: "MANAGER",
    };
    const repository = new AuthorizationRoleSpyRepository(updatedUser);
    const service = new AuthorizationService(repository);

    await expect(service.changeUserRole("user-1", "MANAGER")).resolves.toEqual(
      updatedUser,
    );
    expect(repository.receivedUserId).toBe("user-1");
    expect(repository.receivedRole).toBe("MANAGER");
  });

  it("propagates an error when the target user does not exist", async () => {
    const repository = new AuthorizationRoleSpyRepository(
      new AuthorizationUserNotFoundError(),
    );
    const service = new AuthorizationService(repository);

    await expect(
      service.changeUserRole("missing-user", "MANAGER"),
    ).rejects.toBeInstanceOf(AuthorizationUserNotFoundError);
  });

  it("propagates an error when the change would remove the last ADMIN", async () => {
    const repository = new AuthorizationRoleSpyRepository(
      new LastAdminRoleChangeError(),
    );
    const service = new AuthorizationService(repository);

    await expect(
      service.changeUserRole("last-admin", "VIEWER"),
    ).rejects.toBeInstanceOf(LastAdminRoleChangeError);
  });
});
