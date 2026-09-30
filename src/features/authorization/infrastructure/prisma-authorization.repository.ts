import type { PrismaClient } from "../../../generated/prisma/client.js";
import type {
  AuthorizationRepository,
  UserListQuery,
  UserListResult,
} from "../domain/authorization.repository.js";

export class PrismaAuthorizationRepository implements Pick<
  AuthorizationRepository,
  "findUsers"
> {
  constructor(private readonly prisma: PrismaClient) {}

  async findUsers(query: UserListQuery): Promise<UserListResult> {
    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        orderBy: { id: "asc" },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        select: {
          id: true,
          email: true,
          role: true,
        },
      }),
      this.prisma.user.count(),
    ]);

    return { users, total };
  }
}
