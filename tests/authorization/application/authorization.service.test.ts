import { describe, expect, it } from "vitest";

import { AuthorizationService } from "../../../src/features/authorization/application/authorization.service.js";
import type {
  AuthorizationUserSummary,
  AuthorizationRepository,
  UserListQuery,
  UserListResult,
} from "../../../src/features/authorization/domain/authorization.repository.js";

class AuthorizationListSpyRepository implements AuthorizationRepository {
  receivedQuery: UserListQuery | undefined;

  constructor(private readonly result: UserListResult) {}

  async findUsers(query: UserListQuery): Promise<UserListResult> {
    this.receivedQuery = query;

    return this.result;
  }

  async changeUserRole(): Promise<AuthorizationUserSummary> {
    throw new Error("changeUserRole should not be called");
  }
}

describe("AuthorizationService.listUsers", () => {
  it("returns public user summaries and the repository total with default pagination", async () => {
    const result: UserListResult = {
      users: [
        {
          id: "user-1",
          email: "viewer@example.com",
          role: "VIEWER",
        },
      ],
      total: 23,
    };
    const repository = new AuthorizationListSpyRepository(result);
    const service = new AuthorizationService(repository);

    await expect(service.listUsers()).resolves.toEqual(result);
    expect(repository.receivedQuery).toEqual({ page: 1, limit: 15 });
  });

  it("forwards explicit pagination and preserves the total", async () => {
    const result: UserListResult = { users: [], total: 23 };
    const repository = new AuthorizationListSpyRepository(result);
    const service = new AuthorizationService(repository);

    await expect(service.listUsers({ page: 2, limit: 10 })).resolves.toEqual(
      result,
    );
    expect(repository.receivedQuery).toEqual({ page: 2, limit: 10 });
  });
});
