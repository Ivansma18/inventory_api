import type {
  Category as PrismaCategory,
  Prisma,
  PrismaClient,
} from "../../../generated/prisma/client.js";
import type { Category } from "../domain/category.entity.js";
import type {
  CategoryListQuery,
  CategoryListResult,
  CategoryRepository,
} from "../domain/category.repository.js";

type CategoryRepositoryOperations = Pick<
  CategoryRepository,
  "create" | "findByNameNormalized" | "findByUuid" | "findMany" | "update"
>;

export class PrismaCategoryRepository implements CategoryRepositoryOperations {
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
