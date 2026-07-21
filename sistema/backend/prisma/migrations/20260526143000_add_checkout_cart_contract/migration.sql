-- Milestone 05 - cart, checkout sessions and checkout event contract.

CREATE TABLE "carts" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL DEFAULT 'tenant_default',
  "storeId" TEXT NOT NULL DEFAULT 'store_default',
  "customerId" TEXT,
  "deviceId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "carts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "cart_items" (
  "id" TEXT NOT NULL,
  "cartId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "quantity" DECIMAL(12,3) NOT NULL,
  "notes" TEXT,
  "allowSubstitution" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "cart_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "checkout_sessions" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL DEFAULT 'tenant_default',
  "storeId" TEXT NOT NULL DEFAULT 'store_default',
  "cartId" TEXT NOT NULL,
  "customerId" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'STARTED',
  "priceSnapshot" JSONB,
  "deliverySnapshot" JSONB,
  "stockSnapshot" JSONB,
  "paymentSnapshot" JSONB,
  "orderId" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "checkout_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "checkout_events" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL DEFAULT 'tenant_default',
  "storeId" TEXT NOT NULL DEFAULT 'store_default',
  "cartId" TEXT,
  "checkoutSessionId" TEXT,
  "customerId" TEXT,
  "deviceId" TEXT,
  "type" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "checkout_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "carts_tenantId_storeId_status_updatedAt_idx"
  ON "carts"("tenantId", "storeId", "status", "updatedAt");
CREATE INDEX "carts_tenantId_customerId_status_idx"
  ON "carts"("tenantId", "customerId", "status");
CREATE INDEX "carts_deviceId_status_idx"
  ON "carts"("deviceId", "status");

CREATE UNIQUE INDEX "cart_items_cartId_productId_key"
  ON "cart_items"("cartId", "productId");
CREATE INDEX "cart_items_productId_idx" ON "cart_items"("productId");

CREATE UNIQUE INDEX "checkout_sessions_tenantId_storeId_idempotencyKey_key"
  ON "checkout_sessions"("tenantId", "storeId", "idempotencyKey");
CREATE INDEX "checkout_sessions_tenantId_storeId_status_expiresAt_idx"
  ON "checkout_sessions"("tenantId", "storeId", "status", "expiresAt");
CREATE INDEX "checkout_sessions_tenantId_storeId_cartId_idx"
  ON "checkout_sessions"("tenantId", "storeId", "cartId");
CREATE INDEX "checkout_sessions_orderId_idx" ON "checkout_sessions"("orderId");

CREATE INDEX "checkout_events_tenantId_storeId_type_createdAt_idx"
  ON "checkout_events"("tenantId", "storeId", "type", "createdAt");
CREATE INDEX "checkout_events_cartId_type_idx"
  ON "checkout_events"("cartId", "type");
CREATE INDEX "checkout_events_checkoutSessionId_type_idx"
  ON "checkout_events"("checkoutSessionId", "type");

ALTER TABLE "cart_items"
  ADD CONSTRAINT "cart_items_cartId_fkey"
  FOREIGN KEY ("cartId") REFERENCES "carts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
