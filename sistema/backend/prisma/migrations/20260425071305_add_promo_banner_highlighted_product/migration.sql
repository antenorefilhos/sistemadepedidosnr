-- AlterTable
ALTER TABLE "promo_banners_cms" ADD COLUMN     "highlightNote" TEXT,
ADD COLUMN     "highlightedProductId" TEXT;

-- AddForeignKey
ALTER TABLE "promo_banners_cms" ADD CONSTRAINT "promo_banners_cms_highlightedProductId_fkey" FOREIGN KEY ("highlightedProductId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
