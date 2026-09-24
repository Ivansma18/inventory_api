BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Product" WHERE "categoryId" IS NULL) THEN
    RAISE EXCEPTION 'Cannot require Product.categoryId while unclassified products exist.';
  END IF;
END $$;

ALTER TABLE "Product" ALTER COLUMN "categoryId" SET NOT NULL;

COMMIT;
