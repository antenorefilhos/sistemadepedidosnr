-- Ajustes do admin que o sync do ERP respeita (29/09/2026).
ALTER TABLE "products" ADD COLUMN "erpActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "products" ADD COLUMN "erpSyncOption" TEXT;
ALTER TABLE "products" ADD COLUMN "siteVisibility" TEXT;
ALTER TABLE "products" ADD COLUMN "categoryOverrideId" TEXT;
UPDATE "products" SET "erpActive" = "active", "erpSyncOption" = "syncOption";
