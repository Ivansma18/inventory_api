import type {
  AuthorizationRepository,
  UserListQuery,
  UserListResult,
} from "../domain/authorization.repository.js";

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
}
