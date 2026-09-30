import { Prisma } from "../../../generated/prisma/client.js";
import type { PrismaClient } from "../../../generated/prisma/client.js";
import type {
  AuthorizationUserSummary,
  AuthorizationRepository,
  UserListQuery,
  UserListResult,
} from "../domain/authorization.repository.js";
import {
  AuthorizationUserNotFoundError,
  LastAdminRoleChangeError,
} from "../domain/authorization.errors.js";

export class PrismaAuthorizationRepository implements AuthorizationRepository {
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

  async changeUserRole(
    userId: string,
    role: AuthorizationUserSummary["role"],
  ): Promise<AuthorizationUserSummary> {
    return this.runSerializableTransaction(async (transaction) => {
      const user = await transaction.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, role: true },
      });

      if (!user) {
        throw new AuthorizationUserNotFoundError();
      }

      if (user.role === "ADMIN" && role !== "ADMIN") {
        const administratorCount = await transaction.user.count({
          where: { role: "ADMIN" },
        });

        if (administratorCount <= 1) {
          throw new LastAdminRoleChangeError();
        }
      }

      return transaction.user.update({
        where: { id: userId },
        data: { role },
        select: { id: true, email: true, role: true },
      });
    });
  }

  private async runSerializableTransaction<T>(
    operation: (transaction: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.prisma.$transaction(operation, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        });
      } catch (error) {
        if (!isTransactionConflict(error) || attempt === 2) {
          throw error;
        }
      }
    }

    throw new Error("Serializable transaction retry limit was reached.");
  }
}

function isTransactionConflict(error: unknown): boolean {
  const source =
    error instanceof Error && "cause" in error ? error.cause : error;

  return (
    (source instanceof Prisma.PrismaClientKnownRequestError &&
      source.code === "P2034") ||
    (typeof source === "object" &&
      source !== null &&
      "sqlState" in source &&
      (source.sqlState === "40001" || source.sqlState === "40P01")) ||
    (typeof source === "object" &&
      source !== null &&
      "kind" in source &&
      source.kind === "TransactionWriteConflict") ||
    (source instanceof Error &&
      source.message === "TransactionWriteConflict") ||
    (typeof error === "object" &&
      error !== null &&
      "kind" in error &&
      error.kind === "TransactionWriteConflict") ||
    (error instanceof Error && error.message === "TransactionWriteConflict")
  );
}
