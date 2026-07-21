-- Milestone 06 - OMS by event and item-level operational fields.

ALTER TABLE "orders"
  ADD COLUMN "channel" TEXT NOT NULL DEFAULT 'STOREFRONT',
  ADD COLUMN "fulfillmentType" TEXT NOT NULL DEFAULT 'DELIVERY';

ALTER TABLE "order_items"
  ADD COLUMN "requestedQuantity" DECIMAL(12,3),
  ADD COLUMN "fulfilledQuantity" DECIMAL(12,3),
  ADD COLUMN "finalUnitPrice" DECIMAL(10,2),
  ADD COLUMN "finalSubtotal" DECIMAL(10,2),
  ADD COLUMN "status" TEXT NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "substitutionPolicy" TEXT NOT NULL DEFAULT 'ALLOW',
  ADD COLUMN "substitutedByItemId" TEXT,
  ADD COLUMN "cutReason" TEXT,
  ADD COLUMN "pickerNotes" TEXT;

UPDATE "order_items"
SET
  "requestedQuantity" = COALESCE("requestedQuantity", "quantity"::DECIMAL(12,3)),
  "fulfilledQuantity" = COALESCE("fulfilledQuantity", "quantity"::DECIMAL(12,3)),
  "finalUnitPrice" = COALESCE("finalUnitPrice", "unitPrice"::DECIMAL(10,2)),
  "finalSubtotal" = COALESCE("finalSubtotal", "subtotal"::DECIMAL(10,2)),
  "status" = COALESCE("status", 'PENDING'),
  "substitutionPolicy" = COALESCE("substitutionPolicy", 'ALLOW');

CREATE INDEX "order_items_tenantId_storeId_status_idx"
  ON "order_items"("tenantId", "storeId", "status");

CREATE TABLE "order_events" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL DEFAULT 'tenant_default',
  "storeId" TEXT NOT NULL DEFAULT 'store_default',
  "orderId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "actorType" TEXT NOT NULL DEFAULT 'SYSTEM',
  "actorId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "order_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "order_events_tenantId_storeId_orderId_createdAt_idx"
  ON "order_events"("tenantId", "storeId", "orderId", "createdAt");
CREATE INDEX "order_events_tenantId_storeId_type_createdAt_idx"
  ON "order_events"("tenantId", "storeId", "type", "createdAt");

INSERT INTO "order_events" (
  "id",
  "tenantId",
  "storeId",
  "orderId",
  "type",
  "payload",
  "actorType",
  "createdAt"
)
SELECT
  'oe_backfill_created_' || "id",
  COALESCE("tenantId", 'tenant_default'),
  COALESCE("storeId", 'store_default'),
  "id",
  'order.created',
  jsonb_build_object(
    'source', 'backfill',
    'status', "status",
    'total', "total",
    'createdAt', "createdAt"
  ),
  'SYSTEM',
  NOW()
FROM "orders"
ON CONFLICT ("id") DO NOTHING;
