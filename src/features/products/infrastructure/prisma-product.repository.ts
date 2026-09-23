import type {
  Prisma,
  PrismaClient,
  Product as PrismaProduct,
} from "../../../generated/prisma/client.js";
import type { Product } from "../domain/product.entity.js";
import type {
  ProductListQuery,
  ProductListResult,
  ProductRepository,
} from "../domain/product.repository.js";

export class PrismaProductRepository implements ProductRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(product: Product): Promise<Product> {
    const createdProduct = await this.prisma.product.create({
      data: {
        uuid: product.uuid,
        sku: product.sku,
        skuNormalized: product.skuNormalized,
        name: product.name,
        description: product.description,
        purchasePrice: product.purchasePrice,
        salePrice: product.salePrice,
        isActive: product.isActive,
        createdAt: product.createdAt,
        updatedAt: product.updatedAt,
      },
    });

    return toDomainProduct(createdProduct);
  }

  async findBySkuNormalized(skuNormalized: string): Promise<Product | null> {
    const product = await this.prisma.product.findUnique({
      where: { skuNormalized },
    });

    return product ? toDomainProduct(product) : null;
  }

  async findByUuid(uuid: string): Promise<Product | null> {
    const product = await this.prisma.product.findUnique({ where: { uuid } });

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
      }),
      this.prisma.product.count({ where }),
    ]);

    return { products: products.map(toDomainProduct), total };
  }

  async update(product: Product): Promise<Product> {
    const updatedProduct = await this.prisma.product.update({
      where: { uuid: product.uuid },
      data: {
        sku: product.sku,
        skuNormalized: product.skuNormalized,
        name: product.name,
        description: product.description,
        purchasePrice: product.purchasePrice,
        salePrice: product.salePrice,
        isActive: product.isActive,
        updatedAt: product.updatedAt,
      },
    });

    return toDomainProduct(updatedProduct);
  }
}

function toDomainProduct(product: PrismaProduct): Product {
  return {
    uuid: product.uuid,
    sku: product.sku,
    skuNormalized: product.skuNormalized,
    name: product.name,
    description: product.description,
    purchasePrice: product.purchasePrice.toNumber(),
    salePrice: product.salePrice.toNumber(),
    isActive: product.isActive,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}
