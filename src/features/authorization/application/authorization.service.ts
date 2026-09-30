import type {
  AuthorizationUserSummary,
  AuthorizationRepository,
  UserListQuery,
  UserListResult,
} from "../domain/authorization.repository.js";
import type { UserRole } from "../domain/authorization.policy.js";

export interface ListUsersInput {
  page?: number;
  limit?: number;
}

export class AuthorizationService {
  constructor(private readonly authorization: AuthorizationRepository) {}

  async listUsers(input: ListUsersInput = {}): Promise<UserListResult> {
    const query: UserListQuery = {
      page: input.page ?? 1,
      limit: input.limit ?? 15,
    };

    return this.authorization.findUsers(query);
  }

  async changeUserRole(
    userId: string,
    role: UserRole,
  ): Promise<AuthorizationUserSummary> {
    return this.authorization.changeUserRole(userId, role);
  }
}
