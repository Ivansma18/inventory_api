import { Prisma } from "../../../generated/prisma/client.js";
import type { PrismaClient } from "../../../generated/prisma/client.js";
import type { Inventory } from "../domain/inventory.entity.js";
import type { InventoryRepository } from "../domain/inventory.repository.js";

export class PrismaInventoryRepository implements Pick<
  InventoryRepository,
  "findByProductUuid" | "updateMinimumStock"
> {
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
