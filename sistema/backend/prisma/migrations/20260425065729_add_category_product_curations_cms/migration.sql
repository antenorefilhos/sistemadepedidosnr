-- CreateTable
CREATE TABLE "category_product_curations_cms" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "category_product_curations_cms_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "category_product_curations_cms_categoryId_order_idx" ON "category_product_curations_cms"("categoryId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "category_product_curations_cms_categoryId_productId_key" ON "category_product_curations_cms"("categoryId", "productId");

-- AddForeignKey
ALTER TABLE "category_product_curations_cms" ADD CONSTRAINT "category_product_curations_cms_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories_cms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_product_curations_cms" ADD CONSTRAINT "category_product_curations_cms_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
