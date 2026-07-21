-- CreateTable
CREATE TABLE "category_classification_mappings" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "classificationLevel" INTEGER NOT NULL,
    "classificationValue" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "category_classification_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "category_classification_mappings_categoryId_classificationLevel_classificationValue_key" ON "category_classification_mappings"("categoryId", "classificationLevel", "classificationValue");

-- CreateIndex
CREATE INDEX "category_classification_mappings_classificationLevel_classificationValue_idx" ON "category_classification_mappings"("classificationLevel", "classificationValue");

-- AddForeignKey
ALTER TABLE "category_classification_mappings" ADD CONSTRAINT "category_classification_mappings_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories_cms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
