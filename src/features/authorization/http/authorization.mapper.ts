import type {
  AuthorizationUserSummary,
  UserListResult,
} from "../domain/authorization.repository.js";

export interface AuthorizationUserResponse {
  id: string;
  email: string;
  role: AuthorizationUserSummary["role"];
}

export interface AuthorizationUserListResponse {
  data: AuthorizationUserResponse[];
  pagination: {
    total: number;
    page: number;
    limit: number;
  };
}

export function toAuthorizationUserListResponse(
  result: UserListResult,
  page: number,
  limit: number,
): AuthorizationUserListResponse {
  return {
    data: result.users.map(({ id, email, role }) => ({ id, email, role })),
    pagination: {
      total: result.total,
      page,
      limit,
    },
  };
}
