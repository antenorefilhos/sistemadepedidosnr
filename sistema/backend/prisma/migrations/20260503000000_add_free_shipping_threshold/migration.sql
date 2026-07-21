-- AlterTable: add freeShippingThreshold to brand_config
ALTER TABLE "brand_config" ADD COLUMN IF NOT EXISTS "freeShippingThreshold" DECIMAL(10,2);
