ALTER TABLE "notifications" ADD COLUMN "imageUrl" TEXT;
ALTER TABLE "notifications" ADD COLUMN "productId" TEXT;
ALTER TABLE "products" ADD COLUMN "aiNotifiedAt" TIMESTAMP(3);
