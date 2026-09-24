BEGIN;

-- CreateTable
CREATE TABLE "Inventory" (
    "id" SERIAL NOT NULL,
    "uuid" UUID NOT NULL,
    "productId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "minimumStock" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Inventory_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Inventory_quantity_non_negative" CHECK ("quantity" >= 0),
    CONSTRAINT "Inventory_minimumStock_non_negative" CHECK ("minimumStock" >= 0)
);

-- CreateIndex
CREATE UNIQUE INDEX "Inventory_uuid_key" ON "Inventory"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "Inventory_productId_key" ON "Inventory"("productId");

-- AddForeignKey
ALTER TABLE "Inventory" ADD CONSTRAINT "Inventory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Existing products receive one inventory record before Inventory is used.
INSERT INTO "Inventory" ("uuid", "productId", "quantity", "minimumStock", "updatedAt")
SELECT gen_random_uuid(), "id", 0, 0, CURRENT_TIMESTAMP
FROM "Product"
ON CONFLICT ("productId") DO NOTHING;

COMMIT;
