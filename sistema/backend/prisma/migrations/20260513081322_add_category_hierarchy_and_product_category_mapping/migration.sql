-- DropIndex
DROP INDEX "push_subscriptions_customerId_endpoint_key";

-- AlterTable
ALTER TABLE "categories_cms" ADD COLUMN     "parentId" TEXT;

-- AlterTable
ALTER TABLE "delivery_zones" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "videoUrl" TEXT;

-- CreateTable
CREATE TABLE "product_category_mappings" (
    "id" TEXT NOT NULL,
    "ean" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "subCategoryId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'handoff',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_category_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "product_category_mappings_ean_key" ON "product_category_mappings"("ean");

-- CreateIndex
CREATE INDEX "product_category_mappings_ean_idx" ON "product_category_mappings"("ean");

-- CreateIndex
CREATE INDEX "product_category_mappings_categoryId_idx" ON "product_category_mappings"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "product_category_mappings_ean_categoryId_key" ON "product_category_mappings"("ean", "categoryId");

-- AddForeignKey
ALTER TABLE "categories_cms" ADD CONSTRAINT "categories_cms_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "categories_cms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_category_mappings" ADD CONSTRAINT "product_category_mappings_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories_cms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_category_mappings" ADD CONSTRAINT "product_category_mappings_subCategoryId_fkey" FOREIGN KEY ("subCategoryId") REFERENCES "categories_cms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "category_classification_mappings_categoryId_classificationLevel" RENAME TO "category_classification_mappings_categoryId_classificationL_key";

-- RenameIndex
ALTER INDEX "category_classification_mappings_classificationLevel_classifica" RENAME TO "category_classification_mappings_classificationLevel_classi_idx";
