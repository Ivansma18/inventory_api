import type { UserRole } from "./authorization.policy.js";

export interface AuthorizationUserSummary {
  id: string;
  email: string;
  role: UserRole;
}

export interface UserListQuery {
  page: number;
  limit: number;
}

export interface UserListResult {
  users: AuthorizationUserSummary[];
  total: number;
}

export interface AuthorizationRepository {
  findUsers(query: UserListQuery): Promise<UserListResult>;
  changeUserRole(
    userId: string,
    role: UserRole,
  ): Promise<AuthorizationUserSummary>;
}
