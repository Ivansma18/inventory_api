import { Prisma } from "../../../generated/prisma/client.js";
import type { PrismaClient } from "../../../generated/prisma/client.js";
import type { Product } from "../domain/product.entity.js";
import { ProductCategoryAssignmentConflictError } from "../domain/product.errors.js";
import type {
  ProductListQuery,
  ProductListResult,
  ProductRepository,
} from "../domain/product.repository.js";

export class PrismaProductRepository implements ProductRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(product: Product): Promise<Product> {
    return this.persistWithCategory(product, (transaction, categoryId) =>
      transaction.product.create({
        data: {
          uuid: product.uuid,
          sku: product.sku,
          skuNormalized: product.skuNormalized,
          name: product.name,
          description: product.description,
          purchasePrice: product.purchasePrice,
          salePrice: product.salePrice,
          isActive: product.isActive,
          categoryId,
          createdAt: product.createdAt,
          updatedAt: product.updatedAt,
        },
        include: productCategoryInclude,
      }),
    );
  }

  async findBySkuNormalized(skuNormalized: string): Promise<Product | null> {
    const product = await this.prisma.product.findUnique({
      where: { skuNormalized },
      include: productCategoryInclude,
    });

    return product ? toDomainProduct(product) : null;
  }

  async findByUuid(uuid: string): Promise<Product | null> {
    const product = await this.prisma.product.findUnique({
      where: { uuid },
      include: productCategoryInclude,
    });

    return product ? toDomainProduct(product) : null;
  }

  async findMany(query: ProductListQuery): Promise<ProductListResult> {
    const where: Prisma.ProductWhereInput = {
      isActive: query.isActive,
      ...(query.search
        ? {
            OR: [
              { sku: { contains: query.search, mode: "insensitive" } },
              { name: { contains: query.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    const orderBy: Prisma.ProductOrderByWithRelationInput[] = [
      { [query.sort]: query.order } as Prisma.ProductOrderByWithRelationInput,
      ...query.tieBreakers.map(
        ({ sort, order }) =>
          ({ [sort]: order }) as Prisma.ProductOrderByWithRelationInput,
      ),
    ];
    const [products, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        orderBy,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        include: productCategoryInclude,
      }),
      this.prisma.product.count({ where }),
    ]);

    return { products: products.map(toDomainProduct), total };
  }

  async update(product: Product): Promise<Product> {
    return this.persistWithCategory(product, (transaction, categoryId) =>
      transaction.product.update({
        where: { uuid: product.uuid },
        data: {
          sku: product.sku,
          skuNormalized: product.skuNormalized,
          name: product.name,
          description: product.description,
          purchasePrice: product.purchasePrice,
          salePrice: product.salePrice,
          isActive: product.isActive,
          categoryId,
          updatedAt: product.updatedAt,
        },
        include: productCategoryInclude,
      }),
    );
  }

  private async persistWithCategory(
    product: Product,
    operation: (
      transaction: Prisma.TransactionClient,
      categoryId: number | null,
    ) => Promise<PrismaProductWithCategory>,
  ): Promise<Product> {
    try {
      const storedProduct = await this.runSerializableTransaction(
        async (transaction) => {
          const categoryId = await this.findActiveCategoryId(
            transaction,
            product.categoryUuid,
          );

          return operation(transaction, categoryId);
        },
      );

      return toDomainProduct(storedProduct);
    } catch (error) {
      if (isForeignKeyConflict(error)) {
        throw new ProductCategoryAssignmentConflictError();
      }

      throw error;
    }
  }

  private async findActiveCategoryId(
    transaction: Prisma.TransactionClient,
    categoryUuid: string | null,
  ): Promise<number | null> {
    if (categoryUuid === null) {
      return null;
    }

    const category = await transaction.category.findUnique({
      where: { uuid: categoryUuid },
      select: { id: true, isActive: true },
    });

    if (!category?.isActive) {
      throw new ProductCategoryAssignmentConflictError();
    }

    return category.id;
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

const productCategoryInclude = {
  category: { select: { uuid: true } },
} satisfies Prisma.ProductInclude;

type PrismaProductWithCategory = Prisma.ProductGetPayload<{
  include: typeof productCategoryInclude;
}>;

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

function isForeignKeyConflict(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2003"
  );
}

function toDomainProduct(product: PrismaProductWithCategory): Product {
  return {
    uuid: product.uuid,
    sku: product.sku,
    skuNormalized: product.skuNormalized,
    name: product.name,
    description: product.description,
    purchasePrice: product.purchasePrice.toNumber(),
    salePrice: product.salePrice.toNumber(),
    categoryUuid: product.category?.uuid ?? null,
    isActive: product.isActive,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}
