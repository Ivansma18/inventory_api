import { randomUUID } from "node:crypto";

import { afterEach, describe, expect, it } from "vitest";

import { app } from "../../../src/app.js";
import { prisma } from "../../../src/shared/database/prisma.js";

const createdCategoryUuids: string[] = [];

afterEach(async () => {
  await prisma.category.deleteMany({
    where: { uuid: { in: createdCategoryUuids } },
  });
  createdCategoryUuids.length = 0;
});

describe("POST /products", () => {
  it("rolls back product creation and returns the standard internal error when inventory creation fails", async () => {
    const suffix = randomUUID().replaceAll("-", "");
    const categoryUuid = randomUUID();
    const triggerName = `inventory_creation_failure_${suffix}`;
    const functionName = `${triggerName}_function`;
    createdCategoryUuids.push(categoryUuid);

    await prisma.category.create({
      data: {
        uuid: categoryUuid,
        name: `Category ${suffix}`,
        nameNormalized: `category ${suffix}`,
      },
    });

    try {
      await prisma.$executeRawUnsafe(`
        CREATE FUNCTION "${functionName}"() RETURNS trigger AS $$
        BEGIN
          RAISE EXCEPTION 'Inventory creation failed';
        END;
        $$ LANGUAGE plpgsql;
      `);
      await prisma.$executeRawUnsafe(`
        CREATE TRIGGER "${triggerName}"
        BEFORE INSERT ON "Inventory"
        FOR EACH ROW EXECUTE FUNCTION "${functionName}"();
      `);

      const response = await app.request("/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sku: `SKU-${suffix}`,
          name: "Atomic product",
          purchasePrice: 100,
          salePrice: 150,
          categoryUuid,
        }),
      });

      expect(response.status).toBe(500);
      await expect(response.json()).resolves.toEqual({
        error: {
          code: "INTERNAL_ERROR",
          message: "An unexpected error occurred.",
        },
      });
      await expect(
        prisma.product.findUnique({
          where: { skuNormalized: `sku-${suffix}` },
        }),
      ).resolves.toBeNull();
    } finally {
      await prisma.$executeRawUnsafe(
        `DROP TRIGGER IF EXISTS "${triggerName}" ON "Inventory"`,
      );
      await prisma.$executeRawUnsafe(
        `DROP FUNCTION IF EXISTS "${functionName}"()`,
      );
    }
  });
});
