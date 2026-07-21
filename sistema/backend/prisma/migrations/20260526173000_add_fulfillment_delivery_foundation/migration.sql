ALTER TABLE "orders"
  ADD COLUMN "deliveryAreaId" TEXT,
  ADD COLUMN "fulfillmentSlotId" TEXT,
  ADD COLUMN "fulfillmentSlotItemCount" INTEGER;

ALTER TABLE "checkout_sessions"
  ADD COLUMN "fulfillmentSlotId" TEXT,
  ADD COLUMN "fulfillmentSlotReserved" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "fulfillmentSlotItemCount" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "delivery_areas" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL DEFAULT 'tenant_default',
  "storeId" TEXT NOT NULL DEFAULT 'store_default',
  "name" TEXT NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'CEP_RANGE',
  "rule" JSONB NOT NULL,
  "fee" DECIMAL(10, 2) NOT NULL,
  "minimumOrder" DECIMAL(10, 2),
  "freeAbove" DECIMAL(10, 2),
  "priority" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "delivery_areas_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "fulfillment_slots" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL DEFAULT 'tenant_default',
  "storeId" TEXT NOT NULL DEFAULT 'store_default',
  "type" TEXT NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "capacityOrders" INTEGER NOT NULL,
  "capacityItems" INTEGER,
  "reservedOrders" INTEGER NOT NULL DEFAULT 0,
  "reservedItems" INTEGER NOT NULL DEFAULT 0,
  "cutoffMinutes" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "fulfillment_slots_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "drivers" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL DEFAULT 'tenant_default',
  "storeId" TEXT NOT NULL DEFAULT 'store_default',
  "name" TEXT NOT NULL,
  "phone" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "drivers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "delivery_routes" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL DEFAULT 'tenant_default',
  "storeId" TEXT NOT NULL DEFAULT 'store_default',
  "driverId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PLANNED',
  "startsAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "delivery_routes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "delivery_stops" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL DEFAULT 'tenant_default',
  "storeId" TEXT NOT NULL DEFAULT 'store_default',
  "routeId" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "eta" TIMESTAMP(3),
  "deliveredAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "delivery_stops_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "fulfillment_events" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL DEFAULT 'tenant_default',
  "storeId" TEXT NOT NULL DEFAULT 'store_default',
  "orderId" TEXT,
  "routeId" TEXT,
  "stopId" TEXT,
  "type" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "actorType" TEXT NOT NULL DEFAULT 'SYSTEM',
  "actorId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "fulfillment_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "orders_tenantId_storeId_deliveryAreaId_idx" ON "orders"("tenantId", "storeId", "deliveryAreaId");
CREATE INDEX "orders_tenantId_storeId_fulfillmentSlotId_idx" ON "orders"("tenantId", "storeId", "fulfillmentSlotId");
CREATE INDEX "checkout_sessions_tenantId_storeId_fulfillmentSlotId_idx" ON "checkout_sessions"("tenantId", "storeId", "fulfillmentSlotId");

CREATE INDEX "delivery_areas_tenantId_storeId_status_priority_idx" ON "delivery_areas"("tenantId", "storeId", "status", "priority");
CREATE INDEX "delivery_areas_tenantId_storeId_type_idx" ON "delivery_areas"("tenantId", "storeId", "type");

CREATE INDEX "fulfillment_slots_tenantId_storeId_type_startsAt_idx" ON "fulfillment_slots"("tenantId", "storeId", "type", "startsAt");
CREATE INDEX "fulfillment_slots_tenantId_storeId_status_startsAt_idx" ON "fulfillment_slots"("tenantId", "storeId", "status", "startsAt");

CREATE INDEX "drivers_tenantId_storeId_status_idx" ON "drivers"("tenantId", "storeId", "status");

CREATE INDEX "delivery_routes_tenantId_storeId_status_createdAt_idx" ON "delivery_routes"("tenantId", "storeId", "status", "createdAt");
CREATE INDEX "delivery_routes_tenantId_storeId_driverId_status_idx" ON "delivery_routes"("tenantId", "storeId", "driverId", "status");

CREATE UNIQUE INDEX "delivery_stops_routeId_orderId_key" ON "delivery_stops"("routeId", "orderId");
CREATE INDEX "delivery_stops_tenantId_storeId_status_idx" ON "delivery_stops"("tenantId", "storeId", "status");
CREATE INDEX "delivery_stops_routeId_sequence_idx" ON "delivery_stops"("routeId", "sequence");
CREATE INDEX "delivery_stops_orderId_idx" ON "delivery_stops"("orderId");

CREATE INDEX "fulfillment_events_tenantId_storeId_orderId_createdAt_idx" ON "fulfillment_events"("tenantId", "storeId", "orderId", "createdAt");
CREATE INDEX "fulfillment_events_tenantId_storeId_routeId_createdAt_idx" ON "fulfillment_events"("tenantId", "storeId", "routeId", "createdAt");
CREATE INDEX "fulfillment_events_tenantId_storeId_type_createdAt_idx" ON "fulfillment_events"("tenantId", "storeId", "type", "createdAt");

ALTER TABLE "delivery_routes"
  ADD CONSTRAINT "delivery_routes_driverId_fkey"
  FOREIGN KEY ("driverId") REFERENCES "drivers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "delivery_stops"
  ADD CONSTRAINT "delivery_stops_routeId_fkey"
  FOREIGN KEY ("routeId") REFERENCES "delivery_routes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
