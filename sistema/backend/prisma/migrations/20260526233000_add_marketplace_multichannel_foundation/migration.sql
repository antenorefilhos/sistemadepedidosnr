CREATE TABLE "sales_channels" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL DEFAULT 'tenant_default',
  "storeId" TEXT NOT NULL DEFAULT 'store_default',
  "type" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "config" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "sales_channels_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "channel_products" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL DEFAULT 'tenant_default',
  "storeId" TEXT NOT NULL DEFAULT 'store_default',
  "channelId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "externalId" TEXT,
  "externalSku" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "priceMode" TEXT NOT NULL DEFAULT 'INHERIT',
  "stockMode" TEXT NOT NULL DEFAULT 'INHERIT',
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "channel_products_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "marketplace_orders" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL DEFAULT 'tenant_default',
  "storeId" TEXT NOT NULL DEFAULT 'store_default',
  "channelId" TEXT NOT NULL,
  "externalId" TEXT NOT NULL,
  "orderId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'RECEIVED',
  "mappedStatus" TEXT,
  "payload" JSONB NOT NULL,
  "failureReason" TEXT,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "marketplace_orders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "channel_price_policies" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL DEFAULT 'tenant_default',
  "storeId" TEXT NOT NULL DEFAULT 'store_default',
  "channelId" TEXT NOT NULL,
  "mode" TEXT NOT NULL DEFAULT 'INHERIT',
  "markupPercent" DECIMAL(8,3) NOT NULL DEFAULT 0,
  "minMargin" DECIMAL(8,3),
  "roundingMode" TEXT NOT NULL DEFAULT 'NONE',
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "channel_price_policies_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "channel_stock_policies" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL DEFAULT 'tenant_default',
  "storeId" TEXT NOT NULL DEFAULT 'store_default',
  "channelId" TEXT NOT NULL,
  "bufferQuantity" DECIMAL(12,3) NOT NULL DEFAULT 0,
  "stockMode" TEXT NOT NULL DEFAULT 'AVAILABLE',
  "allowOversell" BOOLEAN NOT NULL DEFAULT false,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "channel_stock_policies_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sales_channels_tenantId_storeId_type_provider_key"
  ON "sales_channels"("tenantId", "storeId", "type", "provider");
CREATE INDEX "sales_channels_tenantId_storeId_status_idx"
  ON "sales_channels"("tenantId", "storeId", "status");
CREATE INDEX "sales_channels_type_provider_status_idx"
  ON "sales_channels"("type", "provider", "status");

CREATE UNIQUE INDEX "channel_products_channelId_productId_key"
  ON "channel_products"("channelId", "productId");
CREATE UNIQUE INDEX "channel_products_channelId_externalId_key"
  ON "channel_products"("channelId", "externalId");
CREATE INDEX "channel_products_tenantId_storeId_status_idx"
  ON "channel_products"("tenantId", "storeId", "status");
CREATE INDEX "channel_products_productId_idx"
  ON "channel_products"("productId");

CREATE UNIQUE INDEX "marketplace_orders_channelId_externalId_key"
  ON "marketplace_orders"("channelId", "externalId");
CREATE INDEX "marketplace_orders_tenantId_storeId_status_receivedAt_idx"
  ON "marketplace_orders"("tenantId", "storeId", "status", "receivedAt");
CREATE INDEX "marketplace_orders_orderId_idx"
  ON "marketplace_orders"("orderId");

CREATE UNIQUE INDEX "channel_price_policies_channelId_mode_key"
  ON "channel_price_policies"("channelId", "mode");
CREATE INDEX "channel_price_policies_tenantId_storeId_status_idx"
  ON "channel_price_policies"("tenantId", "storeId", "status");

CREATE UNIQUE INDEX "channel_stock_policies_channelId_stockMode_key"
  ON "channel_stock_policies"("channelId", "stockMode");
CREATE INDEX "channel_stock_policies_tenantId_storeId_status_idx"
  ON "channel_stock_policies"("tenantId", "storeId", "status");

ALTER TABLE "sales_channels"
  ADD CONSTRAINT "sales_channels_storeId_fkey"
  FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "channel_products"
  ADD CONSTRAINT "channel_products_channelId_fkey"
  FOREIGN KEY ("channelId") REFERENCES "sales_channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "marketplace_orders"
  ADD CONSTRAINT "marketplace_orders_channelId_fkey"
  FOREIGN KEY ("channelId") REFERENCES "sales_channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "channel_price_policies"
  ADD CONSTRAINT "channel_price_policies_channelId_fkey"
  FOREIGN KEY ("channelId") REFERENCES "sales_channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "channel_stock_policies"
  ADD CONSTRAINT "channel_stock_policies_channelId_fkey"
  FOREIGN KEY ("channelId") REFERENCES "sales_channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
