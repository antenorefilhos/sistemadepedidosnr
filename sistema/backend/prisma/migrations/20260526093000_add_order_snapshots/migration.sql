ALTER TABLE "orders" ADD COLUMN "customerSnapshot" JSONB;
ALTER TABLE "orders" ADD COLUMN "addressSnapshot" JSONB;
ALTER TABLE "orders" ADD COLUMN "deliverySnapshot" JSONB;
ALTER TABLE "orders" ADD COLUMN "priceSnapshot" JSONB;
