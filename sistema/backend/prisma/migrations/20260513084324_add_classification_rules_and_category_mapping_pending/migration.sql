-- CreateTable
CREATE TABLE "classification_rules" (
    "id" TEXT NOT NULL,
    "handoffCategoryN1" TEXT NOT NULL,
    "mappedCategoryId" TEXT NOT NULL,
    "mappedSubCategoryId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "classification_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "category_mapping_pending" (
    "id" TEXT NOT NULL,
    "ean" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "suggestedCategoryN1" TEXT,
    "suggestedCategoryN2" TEXT,
    "suggestedCategoryId" TEXT,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "category_mapping_pending_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "classification_rules_handoffCategoryN1_idx" ON "classification_rules"("handoffCategoryN1");

-- CreateIndex
CREATE UNIQUE INDEX "classification_rules_handoffCategoryN1_mappedCategoryId_key" ON "classification_rules"("handoffCategoryN1", "mappedCategoryId");

-- CreateIndex
CREATE UNIQUE INDEX "category_mapping_pending_ean_key" ON "category_mapping_pending"("ean");

-- CreateIndex
CREATE INDEX "category_mapping_pending_status_idx" ON "category_mapping_pending"("status");

-- CreateIndex
CREATE INDEX "category_mapping_pending_ean_idx" ON "category_mapping_pending"("ean");

-- AddForeignKey
ALTER TABLE "classification_rules" ADD CONSTRAINT "classification_rules_mappedCategoryId_fkey" FOREIGN KEY ("mappedCategoryId") REFERENCES "categories_cms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classification_rules" ADD CONSTRAINT "classification_rules_mappedSubCategoryId_fkey" FOREIGN KEY ("mappedSubCategoryId") REFERENCES "categories_cms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_mapping_pending" ADD CONSTRAINT "category_mapping_pending_suggestedCategoryId_fkey" FOREIGN KEY ("suggestedCategoryId") REFERENCES "categories_cms"("id") ON DELETE SET NULL ON UPDATE CASCADE;
