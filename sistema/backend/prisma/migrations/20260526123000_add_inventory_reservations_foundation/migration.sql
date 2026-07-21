-- Milestone 03 - inventory, availability and reservations foundation.

CREATE TABLE "stock_positions" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "onHand" DECIMAL(12,3) NOT NULL DEFAULT 0,
  "reserved" DECIMAL(12,3) NOT NULL DEFAULT 0,
  "available" DECIMAL(12,3) NOT NULL DEFAULT 0,
  "safetyStock" DECIMAL(12,3) NOT NULL DEFAULT 0,
  "source" TEXT NOT NULL DEFAULT 'ERP',
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "stock_positions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "stock_ledger" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "quantity" DECIMAL(12,3) NOT NULL,
  "balance" DECIMAL(12,3),
  "referenceId" TEXT,
  "reason" TEXT,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "stock_ledger_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "stock_reservations" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "orderId" TEXT,
  "cartId" TEXT,
  "productId" TEXT NOT NULL,
  "quantity" DECIMAL(12,3) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "stock_reservations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "stock_reconciliation_runs" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  "checkedCount" INTEGER NOT NULL DEFAULT 0,
  "divergenceCount" INTEGER NOT NULL DEFAULT 0,
  "summary" JSONB,
  "createdBy" TEXT,

  CONSTRAINT "stock_reconciliation_runs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "stock_policies" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "productId" TEXT,
  "categoryId" TEXT,
  "safetyStock" DECIMAL(12,3) NOT NULL DEFAULT 0,
  "allowBackorder" BOOLEAN NOT NULL DEFAULT false,
  "reservationTtlMin" INTEGER NOT NULL DEFAULT 15,
  "weightedMinQuantity" DECIMAL(12,3),
  "weightedStep" DECIMAL(12,3),
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "stock_policies_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "stock_positions_tenantId_storeId_productId_key"
  ON "stock_positions"("tenantId", "storeId", "productId");
CREATE INDEX "stock_positions_tenantId_storeId_available_idx"
  ON "stock_positions"("tenantId", "storeId", "available");
CREATE INDEX "stock_positions_tenantId_storeId_source_idx"
  ON "stock_positions"("tenantId", "storeId", "source");

CREATE INDEX "stock_ledger_tenantId_storeId_productId_createdAt_idx"
  ON "stock_ledger"("tenantId", "storeId", "productId", "createdAt");
CREATE INDEX "stock_ledger_tenantId_storeId_type_createdAt_idx"
  ON "stock_ledger"("tenantId", "storeId", "type", "createdAt");
CREATE INDEX "stock_ledger_referenceId_idx"
  ON "stock_ledger"("referenceId");

CREATE INDEX "stock_reservations_tenantId_storeId_productId_status_idx"
  ON "stock_reservations"("tenantId", "storeId", "productId", "status");
CREATE INDEX "stock_reservations_tenantId_storeId_orderId_status_idx"
  ON "stock_reservations"("tenantId", "storeId", "orderId", "status");
CREATE INDEX "stock_reservations_tenantId_storeId_cartId_status_idx"
  ON "stock_reservations"("tenantId", "storeId", "cartId", "status");
CREATE INDEX "stock_reservations_status_expiresAt_idx"
  ON "stock_reservations"("status", "expiresAt");

CREATE INDEX "stock_reconciliation_runs_tenantId_storeId_status_startedAt_idx"
  ON "stock_reconciliation_runs"("tenantId", "storeId", "status", "startedAt");

CREATE INDEX "stock_policies_tenantId_storeId_productId_status_idx"
  ON "stock_policies"("tenantId", "storeId", "productId", "status");
CREATE INDEX "stock_policies_tenantId_storeId_categoryId_status_idx"
  ON "stock_policies"("tenantId", "storeId", "categoryId", "status");

INSERT INTO "stock_positions" (
  "id",
  "tenantId",
  "storeId",
  "productId",
  "onHand",
  "reserved",
  "available",
  "safetyStock",
  "source",
  "updatedAt"
)
SELECT
  'sp_' || "id",
  COALESCE("tenantId", 'tenant_default'),
  COALESCE("storeId", 'store_default'),
  "id",
  COALESCE("stock", 0)::DECIMAL(12,3),
  0,
  GREATEST(COALESCE("stock", 0), 0)::DECIMAL(12,3),
  0,
  'LEGACY_BACKFILL',
  NOW()
FROM "products"
ON CONFLICT ("tenantId", "storeId", "productId") DO UPDATE SET
  "onHand" = EXCLUDED."onHand",
  "reserved" = EXCLUDED."reserved",
  "available" = EXCLUDED."available",
  "source" = EXCLUDED."source",
  "updatedAt" = NOW();

INSERT INTO "stock_ledger" (
  "id",
  "tenantId",
  "storeId",
  "productId",
  "type",
  "quantity",
  "balance",
  "referenceId",
  "reason",
  "createdAt"
)
SELECT
  'sl_backfill_' || "id",
  COALESCE("tenantId", 'tenant_default'),
  COALESCE("storeId", 'store_default'),
  "id",
  'SYNC',
  COALESCE("stock", 0)::DECIMAL(12,3),
  COALESCE("stock", 0)::DECIMAL(12,3),
  'legacy_product_stock',
  'Initial stock position backfill from products.stock',
  NOW()
FROM "products";

INSERT INTO "stock_policies" (
  "id",
  "tenantId",
  "storeId",
  "productId",
  "allowBackorder",
  "reservationTtlMin",
  "status",
  "createdAt",
  "updatedAt"
)
SELECT
  'spol_' || "id",
  COALESCE("tenantId", 'tenant_default'),
  COALESCE("storeId", 'store_default'),
  "id",
  true,
  15,
  'ACTIVE',
  NOW(),
  NOW()
FROM "products"
WHERE UPPER(COALESCE("syncOption", 'ESTOQUE')) = 'SEMPRE';
