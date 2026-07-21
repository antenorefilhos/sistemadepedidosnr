-- Milestone 04 - price lists, promotions, coupons and commercial audit foundation.

CREATE TABLE "price_lists" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "storeId" TEXT,
  "channel" TEXT NOT NULL,
  "customerSegment" TEXT,
  "customerId" TEXT,
  "name" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "price_lists_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "price_list_items" (
  "id" TEXT NOT NULL,
  "priceListId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "price" DECIMAL(10,2) NOT NULL,
  "cost" DECIMAL(10,2),
  "margin" DECIMAL(10,2),
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "price_list_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "promotions" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "storeId" TEXT,
  "name" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "priority" INTEGER NOT NULL DEFAULT 0,
  "stackable" BOOLEAN NOT NULL DEFAULT false,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "budgetLimit" DECIMAL(10,2),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "promotions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "promotion_rules" (
  "id" TEXT NOT NULL,
  "promotionId" TEXT NOT NULL,
  "condition" JSONB NOT NULL,
  "effect" JSONB NOT NULL,

  CONSTRAINT "promotion_rules_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "coupons" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "promotionId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "maxUses" INTEGER,
  "maxUsesPerCustomer" INTEGER,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "coupons_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "promotion_usages" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "promotionId" TEXT NOT NULL,
  "couponId" TEXT,
  "customerId" TEXT,
  "orderId" TEXT,
  "discountAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "promotion_usages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "price_audit_logs" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "storeId" TEXT,
  "priceListId" TEXT,
  "productId" TEXT,
  "action" TEXT NOT NULL,
  "oldValue" JSONB,
  "newValue" JSONB,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "price_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "price_lists_tenantId_storeId_channel_status_idx"
  ON "price_lists"("tenantId", "storeId", "channel", "status");
CREATE INDEX "price_lists_tenantId_customerSegment_customerId_idx"
  ON "price_lists"("tenantId", "customerSegment", "customerId");

CREATE UNIQUE INDEX "price_list_items_priceListId_productId_key"
  ON "price_list_items"("priceListId", "productId");
CREATE INDEX "price_list_items_productId_idx" ON "price_list_items"("productId");
CREATE INDEX "price_list_items_startsAt_endsAt_idx" ON "price_list_items"("startsAt", "endsAt");

CREATE INDEX "promotions_tenantId_storeId_status_priority_idx"
  ON "promotions"("tenantId", "storeId", "status", "priority");
CREATE INDEX "promotions_tenantId_type_idx" ON "promotions"("tenantId", "type");

CREATE INDEX "promotion_rules_promotionId_idx" ON "promotion_rules"("promotionId");

CREATE UNIQUE INDEX "coupons_tenantId_code_key" ON "coupons"("tenantId", "code");
CREATE INDEX "coupons_promotionId_status_idx" ON "coupons"("promotionId", "status");

CREATE INDEX "promotion_usages_tenantId_promotionId_createdAt_idx"
  ON "promotion_usages"("tenantId", "promotionId", "createdAt");
CREATE INDEX "promotion_usages_tenantId_couponId_customerId_idx"
  ON "promotion_usages"("tenantId", "couponId", "customerId");
CREATE INDEX "promotion_usages_orderId_idx" ON "promotion_usages"("orderId");

CREATE INDEX "price_audit_logs_tenantId_storeId_createdAt_idx"
  ON "price_audit_logs"("tenantId", "storeId", "createdAt");
CREATE INDEX "price_audit_logs_priceListId_productId_idx"
  ON "price_audit_logs"("priceListId", "productId");

ALTER TABLE "price_list_items"
  ADD CONSTRAINT "price_list_items_priceListId_fkey"
  FOREIGN KEY ("priceListId") REFERENCES "price_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "promotion_rules"
  ADD CONSTRAINT "promotion_rules_promotionId_fkey"
  FOREIGN KEY ("promotionId") REFERENCES "promotions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "coupons"
  ADD CONSTRAINT "coupons_promotionId_fkey"
  FOREIGN KEY ("promotionId") REFERENCES "promotions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "promotion_usages"
  ADD CONSTRAINT "promotion_usages_promotionId_fkey"
  FOREIGN KEY ("promotionId") REFERENCES "promotions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "promotion_usages"
  ADD CONSTRAINT "promotion_usages_couponId_fkey"
  FOREIGN KEY ("couponId") REFERENCES "coupons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "price_lists" (
  "id",
  "tenantId",
  "storeId",
  "channel",
  "name",
  "status",
  "createdAt",
  "updatedAt"
)
SELECT
  'pl_default_' || COALESCE("tenantId", 'tenant_default') || '_' || COALESCE("storeId", 'store_default'),
  COALESCE("tenantId", 'tenant_default'),
  COALESCE("storeId", 'store_default'),
  'STOREFRONT',
  'Storefront default',
  'ACTIVE',
  NOW(),
  NOW()
FROM "products"
GROUP BY COALESCE("tenantId", 'tenant_default'), COALESCE("storeId", 'store_default')
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "price_list_items" (
  "id",
  "priceListId",
  "productId",
  "price",
  "startsAt",
  "createdAt",
  "updatedAt"
)
SELECT
  'pli_' || "id",
  'pl_default_' || COALESCE("tenantId", 'tenant_default') || '_' || COALESCE("storeId", 'store_default'),
  "id",
  COALESCE("promotionalPrice", "price")::DECIMAL(10,2),
  NOW(),
  NOW(),
  NOW()
FROM "products"
WHERE COALESCE("promotionalPrice", "price") > 0
ON CONFLICT ("priceListId", "productId") DO UPDATE SET
  "price" = EXCLUDED."price",
  "updatedAt" = NOW();

INSERT INTO "price_audit_logs" (
  "id",
  "tenantId",
  "storeId",
  "priceListId",
  "action",
  "newValue",
  "createdAt"
)
SELECT
  'pal_backfill_' || "id",
  "tenantId",
  "storeId",
  "id",
  'BACKFILL',
  jsonb_build_object('channel', "channel", 'source', 'products.price/promotionalPrice'),
  NOW()
FROM "price_lists"
WHERE "id" LIKE 'pl_default_%';
