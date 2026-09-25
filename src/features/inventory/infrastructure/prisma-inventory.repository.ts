import { Prisma } from "../../../generated/prisma/client.js";
import type { PrismaClient } from "../../../generated/prisma/client.js";
import type { Inventory, InventoryStatus } from "../domain/inventory.entity.js";
import type {
  InventoryListQuery,
  InventoryListResult,
  InventoryRepository,
} from "../domain/inventory.repository.js";

export class PrismaInventoryRepository implements InventoryRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByProductUuid(productUuid: string): Promise<Inventory | null> {
    const inventory = await this.prisma.inventory.findFirst({
      where: { product: { uuid: productUuid } },
      include: inventoryProductInclude,
    });

    return inventory ? toDomainInventory(inventory) : null;
  }

  async updateMinimumStock(inventory: Inventory): Promise<Inventory> {
    const updatedInventory = await this.prisma.inventory.update({
      where: { uuid: inventory.uuid },
      data: {
        minimumStock: inventory.minimumStock,
        updatedAt: inventory.updatedAt,
      },
      include: inventoryProductInclude,
    });

    return toDomainInventory(updatedInventory);
  }

  async findMany(query: InventoryListQuery): Promise<InventoryListResult> {
    const where = this.toInventoryWhere(query);
    const [inventories, total] = await this.prisma.$transaction([
      this.prisma.inventory.findMany({
        where,
        orderBy: this.toOrderBy(query),
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        include: inventoryProductInclude,
      }),
      this.prisma.inventory.count({ where }),
    ]);

    return { inventories: inventories.map(toDomainInventory), total };
  }

  private toInventoryWhere(
    query: InventoryListQuery,
  ): Prisma.InventoryWhereInput {
    const product: Prisma.ProductWhereInput = {
      ...(query.isActive === undefined ? {} : { isActive: query.isActive }),
      ...(query.search
        ? {
            OR: [
              { sku: { contains: query.search, mode: "insensitive" } },
              { name: { contains: query.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    return {
      ...(Object.keys(product).length > 0 ? { product } : {}),
      ...this.toStatusWhere(query.status),
    };
  }

  private toStatusWhere(
    status: InventoryStatus | undefined,
  ): Prisma.InventoryWhereInput {
    if (status === "OUT_OF_STOCK") {
      return { quantity: 0 };
    }

    if (status === "LOW_STOCK") {
      return {
        AND: [
          { quantity: { gt: 0 } },
          { quantity: { lte: this.prisma.inventory.fields.minimumStock } },
        ],
      };
    }

    if (status === "IN_STOCK") {
      return {
        quantity: { gt: this.prisma.inventory.fields.minimumStock },
      };
    }

    return {};
  }

  private toOrderBy(
    query: InventoryListQuery,
  ): Prisma.InventoryOrderByWithRelationInput[] {
    const primaryOrder =
      query.sort === "name" || query.sort === "sku"
        ? { product: { [query.sort]: query.order } }
        : { [query.sort]: query.order };
    const tieBreakers = query.tieBreakers.map(({ sort, order }) =>
      sort === "productUuid"
        ? { product: { uuid: order } }
        : { product: { sku: order } },
    );

    return [
      primaryOrder as Prisma.InventoryOrderByWithRelationInput,
      ...tieBreakers,
    ];
  }
}

const inventoryProductInclude = {
  product: { include: { category: { select: { uuid: true } } } },
} satisfies Prisma.InventoryInclude;

type PrismaInventoryWithProduct = Prisma.InventoryGetPayload<{
  include: typeof inventoryProductInclude;
}>;

function toDomainInventory(inventory: PrismaInventoryWithProduct): Inventory {
  return {
    uuid: inventory.uuid,
    productUuid: inventory.product.uuid,
    sku: inventory.product.sku,
    name: inventory.product.name,
    categoryUuid: inventory.product.category?.uuid ?? null,
    isActive: inventory.product.isActive,
    quantity: inventory.quantity,
    minimumStock: inventory.minimumStock,
    updatedAt: inventory.updatedAt,
  };
}
