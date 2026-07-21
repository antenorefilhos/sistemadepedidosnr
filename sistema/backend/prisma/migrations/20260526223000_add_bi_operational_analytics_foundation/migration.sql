ALTER TABLE "analytics_events"
  ADD COLUMN "channel" TEXT NOT NULL DEFAULT 'STOREFRONT',
  ADD COLUMN "source" TEXT,
  ADD COLUMN "sessionId" TEXT;

CREATE TABLE "metric_snapshots" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL DEFAULT 'tenant_default',
  "storeId" TEXT NOT NULL DEFAULT 'ALL',
  "period" TEXT NOT NULL DEFAULT 'DAY',
  "periodStart" TIMESTAMP(3) NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL,
  "dashboard" TEXT NOT NULL,
  "metric" TEXT NOT NULL,
  "dimension" TEXT NOT NULL DEFAULT 'GLOBAL',
  "dimensionValue" TEXT NOT NULL DEFAULT 'ALL',
  "channel" TEXT NOT NULL DEFAULT 'ALL',
  "productId" TEXT NOT NULL DEFAULT 'ALL',
  "category" TEXT NOT NULL DEFAULT 'ALL',
  "value" DECIMAL(14,3) NOT NULL DEFAULT 0,
  "unit" TEXT NOT NULL DEFAULT 'COUNT',
  "metadata" JSONB,
  "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "metric_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "analytics_events_tenantId_storeId_channel_createdAt_idx"
  ON "analytics_events"("tenantId", "storeId", "channel", "createdAt");

CREATE INDEX "analytics_events_tenantId_sessionId_createdAt_idx"
  ON "analytics_events"("tenantId", "sessionId", "createdAt");

CREATE UNIQUE INDEX "metric_snapshots_unique_scope"
  ON "metric_snapshots"("tenantId", "storeId", "period", "periodStart", "dashboard", "metric", "dimension", "dimensionValue", "channel", "productId", "category");

CREATE INDEX "metric_snapshots_tenantId_storeId_dashboard_metric_periodStart_idx"
  ON "metric_snapshots"("tenantId", "storeId", "dashboard", "metric", "periodStart");

CREATE INDEX "metric_snapshots_tenantId_storeId_dimension_dimensionValue_periodStart_idx"
  ON "metric_snapshots"("tenantId", "storeId", "dimension", "dimensionValue", "periodStart");

CREATE INDEX "metric_snapshots_tenantId_storeId_channel_periodStart_idx"
  ON "metric_snapshots"("tenantId", "storeId", "channel", "periodStart");

CREATE INDEX "metric_snapshots_tenantId_productId_periodStart_idx"
  ON "metric_snapshots"("tenantId", "productId", "periodStart");

CREATE INDEX "metric_snapshots_tenantId_category_periodStart_idx"
  ON "metric_snapshots"("tenantId", "category", "periodStart");
