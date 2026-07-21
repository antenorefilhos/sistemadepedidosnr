-- CreateTable
CREATE TABLE "brands" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "brands_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "product_masters" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "ean" TEXT,
    "sku" TEXT,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "brandId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "unitType" TEXT NOT NULL,
    "baseUnit" TEXT,
    "packageSize" DECIMAL(10,3),
    "isWeighted" BOOLEAN NOT NULL DEFAULT false,
    "minWeight" DECIMAL(10,3),
    "weightStep" DECIMAL(10,3),
    "averageWeight" DECIMAL(10,3),
    "shelfLifeDays" INTEGER,
    "isPerishable" BOOLEAN NOT NULL DEFAULT false,
    "requiresAgeCheck" BOOLEAN NOT NULL DEFAULT false,
    "legacyProductId" TEXT,
    "legacyPrice" DECIMAL(10,2),
    "legacyPromotionalPrice" DECIMAL(10,2),
    "legacyCategory" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "product_masters_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "product_media" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "alt" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "product_media_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "product_attributes" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    CONSTRAINT "product_attributes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "category_nodes" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "parentId" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "legacyCategoryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "category_nodes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "product_category_assignments" (
    "productId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "confidence" DECIMAL(5,2),
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "product_category_assignments_pkey" PRIMARY KEY ("productId","categoryId")
);

CREATE TABLE "product_substitutions" (
    "productId" TEXT NOT NULL,
    "substituteId" TEXT NOT NULL,
    "priority" INTEGER NOT NULL,
    "rule" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "product_substitutions_pkey" PRIMARY KEY ("productId","substituteId")
);

CREATE TABLE "catalog_quality_issues" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "storeId" TEXT,
    "productId" TEXT,
    "legacyProductId" TEXT,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'WARN',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "source" TEXT NOT NULL DEFAULT 'AUTO',
    "title" TEXT NOT NULL,
    "detail" TEXT,
    "impactScore" INTEGER NOT NULL DEFAULT 0,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "catalog_quality_issues_pkey" PRIMARY KEY ("id")
);

-- Backfill ProductMaster from the current legacy Product table while preserving legacy price/category.
INSERT INTO "product_masters" (
    "id", "tenantId", "ean", "sku", "name", "normalizedName", "status", "unitType", "baseUnit",
    "isWeighted", "minWeight", "weightStep", "averageWeight", "isPerishable",
    "legacyProductId", "legacyPrice", "legacyPromotionalPrice", "legacyCategory",
    "createdAt", "updatedAt"
)
SELECT
    'pm_' || p."id",
    p."tenantId",
    NULLIF(p."ean", ''),
    NULLIF(p."ean", ''),
    p."name",
    UPPER(TRIM(REGEXP_REPLACE(COALESCE(p."name", ''), '\s+', ' ', 'g'))),
    CASE WHEN p."active" THEN 'ACTIVE' ELSE 'INACTIVE' END,
    CASE
      WHEN p."isFractional" THEN 'VARIABLE_WEIGHT'
      WHEN LOWER(COALESCE(p."unit", '')) IN ('kg', 'quilo') THEN 'KG'
      WHEN LOWER(COALESCE(p."unit", '')) IN ('g', 'gr', 'grama') THEN 'G'
      WHEN LOWER(COALESCE(p."unit", '')) IN ('l', 'lt', 'litro') THEN 'L'
      WHEN LOWER(COALESCE(p."unit", '')) IN ('ml') THEN 'ML'
      ELSE 'UNIT'
    END,
    NULLIF(p."unit", ''),
    p."isFractional",
    CASE WHEN p."isFractional" THEN ROUND(COALESCE(NULLIF(p."fractionStep", 0), 0.001)::numeric, 3) ELSE NULL END,
    CASE WHEN p."isFractional" THEN ROUND(COALESCE(NULLIF(p."fractionStep", 0), 0.001)::numeric, 3) ELSE NULL END,
    CASE WHEN p."isFractional" THEN ROUND(COALESCE(NULLIF(p."fractionStep", 0), 0.001)::numeric, 3) ELSE NULL END,
    CASE
      WHEN COALESCE(p."classification01", '') ILIKE '%FLV%' THEN true
      WHEN COALESCE(p."category", '') ILIKE '%HORT%' THEN true
      ELSE false
    END,
    p."id",
    ROUND(p."price"::numeric, 2),
    CASE WHEN p."promotionalPrice" IS NULL THEN NULL ELSE ROUND(p."promotionalPrice"::numeric, 2) END,
    p."category",
    p."createdAt",
    p."updatedAt"
FROM "products" p;

-- Backfill canonical category nodes from the existing CMS hierarchy.
INSERT INTO "category_nodes" (
    "id", "tenantId", "parentId", "name", "slug", "level", "status", "sortOrder", "legacyCategoryId", "createdAt", "updatedAt"
)
SELECT
    'cn_' || c."id",
    c."tenantId",
    CASE WHEN c."parentId" IS NULL THEN NULL ELSE 'cn_' || c."parentId" END,
    c."name",
    COALESCE(NULLIF(LOWER(TRIM(BOTH '-' FROM REGEXP_REPLACE(c."name", '[^a-zA-Z0-9]+', '-', 'g'))), ''), 'cat-' || c."id"),
    CASE WHEN c."parentId" IS NULL THEN 1 ELSE 2 END,
    CASE WHEN c."active" THEN 'ACTIVE' ELSE 'INACTIVE' END,
    c."priority",
    c."id",
    c."createdAt",
    c."updatedAt"
FROM "categories_cms" c;

-- Backfill category assignments from EAN mappings, preferring the N2 node when one exists.
INSERT INTO "product_category_assignments" ("productId", "categoryId", "source", "confidence", "status", "createdAt")
SELECT DISTINCT
    pm."id",
    'cn_' || COALESCE(m."subCategoryId", m."categoryId"),
    UPPER(COALESCE(m."source", 'ERP')),
    100.00,
    'ACTIVE',
    CURRENT_TIMESTAMP
FROM "product_category_mappings" m
JOIN "product_masters" pm ON pm."ean" = m."ean" AND pm."tenantId" = m."tenantId"
WHERE COALESCE(m."subCategoryId", m."categoryId") IS NOT NULL;

-- Backfill video media already stored on legacy products.
INSERT INTO "product_media" ("id", "productId", "type", "url", "alt", "sortOrder", "isPrimary", "status", "createdAt", "updatedAt")
SELECT
    'media_video_' || p."id",
    pm."id",
    'VIDEO',
    p."videoUrl",
    p."name",
    10,
    false,
    'ACTIVE',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "products" p
JOIN "product_masters" pm ON pm."legacyProductId" = p."id"
WHERE p."videoUrl" IS NOT NULL AND TRIM(p."videoUrl") <> '';

-- CreateIndex
CREATE INDEX "brands_tenantId_name_idx" ON "brands"("tenantId", "name");
CREATE UNIQUE INDEX "brands_tenantId_slug_key" ON "brands"("tenantId", "slug");
CREATE UNIQUE INDEX "product_masters_legacyProductId_key" ON "product_masters"("legacyProductId");
CREATE INDEX "product_masters_tenantId_ean_idx" ON "product_masters"("tenantId", "ean");
CREATE INDEX "product_masters_tenantId_normalizedName_idx" ON "product_masters"("tenantId", "normalizedName");
CREATE INDEX "product_masters_tenantId_status_idx" ON "product_masters"("tenantId", "status");
CREATE INDEX "product_media_productId_status_idx" ON "product_media"("productId", "status");
CREATE INDEX "product_media_productId_isPrimary_idx" ON "product_media"("productId", "isPrimary");
CREATE INDEX "product_attributes_productId_key_idx" ON "product_attributes"("productId", "key");
CREATE UNIQUE INDEX "category_nodes_legacyCategoryId_key" ON "category_nodes"("legacyCategoryId");
CREATE INDEX "category_nodes_tenantId_parentId_idx" ON "category_nodes"("tenantId", "parentId");
CREATE INDEX "category_nodes_tenantId_status_sortOrder_idx" ON "category_nodes"("tenantId", "status", "sortOrder");
CREATE UNIQUE INDEX "category_nodes_tenantId_slug_key" ON "category_nodes"("tenantId", "slug");
CREATE INDEX "product_category_assignments_categoryId_status_idx" ON "product_category_assignments"("categoryId", "status");
CREATE INDEX "product_substitutions_substituteId_status_idx" ON "product_substitutions"("substituteId", "status");
CREATE INDEX "catalog_quality_issues_tenantId_status_severity_idx" ON "catalog_quality_issues"("tenantId", "status", "severity");
CREATE INDEX "catalog_quality_issues_tenantId_type_idx" ON "catalog_quality_issues"("tenantId", "type");
CREATE INDEX "catalog_quality_issues_productId_status_idx" ON "catalog_quality_issues"("productId", "status");

-- AddForeignKey
ALTER TABLE "product_masters" ADD CONSTRAINT "product_masters_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "product_media" ADD CONSTRAINT "product_media_productId_fkey" FOREIGN KEY ("productId") REFERENCES "product_masters"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_attributes" ADD CONSTRAINT "product_attributes_productId_fkey" FOREIGN KEY ("productId") REFERENCES "product_masters"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "category_nodes" ADD CONSTRAINT "category_nodes_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "category_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_category_assignments" ADD CONSTRAINT "product_category_assignments_productId_fkey" FOREIGN KEY ("productId") REFERENCES "product_masters"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_category_assignments" ADD CONSTRAINT "product_category_assignments_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "category_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_substitutions" ADD CONSTRAINT "product_substitutions_productId_fkey" FOREIGN KEY ("productId") REFERENCES "product_masters"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_substitutions" ADD CONSTRAINT "product_substitutions_substituteId_fkey" FOREIGN KEY ("substituteId") REFERENCES "product_masters"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "catalog_quality_issues" ADD CONSTRAINT "catalog_quality_issues_productId_fkey" FOREIGN KEY ("productId") REFERENCES "product_masters"("id") ON DELETE CASCADE ON UPDATE CASCADE;
