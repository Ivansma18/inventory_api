import { Prisma } from "../../../generated/prisma/client.js";
import type {
  Category as PrismaCategory,
  PrismaClient,
} from "../../../generated/prisma/client.js";
import type { Category } from "../domain/category.entity.js";
import type {
  CategoryListQuery,
  CategoryListResult,
  CategoryRepository,
} from "../domain/category.repository.js";

export class PrismaCategoryRepository implements CategoryRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(category: Category): Promise<Category> {
    const createdCategory = await this.prisma.category.create({
      data: {
        uuid: category.uuid,
        name: category.name,
        nameNormalized: category.nameNormalized,
        description: category.description,
        isActive: category.isActive,
        createdAt: category.createdAt,
        updatedAt: category.updatedAt,
      },
    });

    return toDomainCategory(createdCategory);
  }

  async findByNameNormalized(nameNormalized: string): Promise<Category | null> {
    const category = await this.prisma.category.findUnique({
      where: { nameNormalized },
    });

    return category ? toDomainCategory(category) : null;
  }

  async findByUuid(uuid: string): Promise<Category | null> {
    const category = await this.prisma.category.findUnique({ where: { uuid } });

    return category ? toDomainCategory(category) : null;
  }

  async findMany(query: CategoryListQuery): Promise<CategoryListResult> {
    const where: Prisma.CategoryWhereInput = {
      isActive: query.isActive,
      ...(query.search
        ? { name: { contains: query.search, mode: "insensitive" } }
        : {}),
    };
    const orderBy: Prisma.CategoryOrderByWithRelationInput[] = [
      { [query.sort]: query.order } as Prisma.CategoryOrderByWithRelationInput,
      ...query.tieBreakers.map(
        ({ sort, order }) =>
          ({ [sort]: order }) as Prisma.CategoryOrderByWithRelationInput,
      ),
    ];
    const [categories, total] = await this.prisma.$transaction([
      this.prisma.category.findMany({
        where,
        orderBy,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.category.count({ where }),
    ]);

    return { categories: categories.map(toDomainCategory), total };
  }

  async update(category: Category): Promise<Category> {
    const updatedCategory = await this.prisma.category.update({
      where: { uuid: category.uuid },
      data: {
        name: category.name,
        nameNormalized: category.nameNormalized,
        description: category.description,
        isActive: category.isActive,
        updatedAt: category.updatedAt,
      },
    });

    return toDomainCategory(updatedCategory);
  }

  async updateIfUnused(
    category: Category,
  ): Promise<Category | "not_found" | "in_use"> {
    return this.runSerializableTransaction(async (transaction) => {
      const storedCategory = await transaction.category.findUnique({
        where: { uuid: category.uuid },
        select: { id: true },
      });

      if (!storedCategory) {
        return "not_found";
      }

      const associatedProduct = await transaction.product.findFirst({
        where: { categoryId: storedCategory.id },
        select: { id: true },
      });

      if (associatedProduct) {
        return "in_use";
      }

      const updatedCategory = await transaction.category.update({
        where: { uuid: category.uuid },
        data: {
          name: category.name,
          nameNormalized: category.nameNormalized,
          description: category.description,
          isActive: category.isActive,
          updatedAt: category.updatedAt,
        },
      });

      return toDomainCategory(updatedCategory);
    });
  }

  async deleteIfUnused(
    uuid: string,
  ): Promise<"deleted" | "not_found" | "in_use"> {
    try {
      return await this.runSerializableTransaction(async (transaction) => {
        const category = await transaction.category.findUnique({
          where: { uuid },
          select: { id: true },
        });

        if (!category) {
          return "not_found";
        }

        const associatedProduct = await transaction.product.findFirst({
          where: { categoryId: category.id },
          select: { id: true },
        });

        if (associatedProduct) {
          return "in_use";
        }

        await transaction.category.delete({ where: { uuid } });

        return "deleted";
      });
    } catch (error) {
      if (isForeignKeyConflict(error)) {
        return "in_use";
      }

      throw error;
    }
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
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2034"
  );
}

function isForeignKeyConflict(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2003"
  );
}

function toDomainCategory(category: PrismaCategory): Category {
  return {
    uuid: category.uuid,
    name: category.name,
    nameNormalized: category.nameNormalized,
    description: category.description,
    isActive: category.isActive,
    createdAt: category.createdAt,
    updatedAt: category.updatedAt,
  };
}
