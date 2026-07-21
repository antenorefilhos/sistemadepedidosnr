CREATE TABLE "recommendation_events" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL DEFAULT 'tenant_default',
  "storeId" TEXT NOT NULL DEFAULT 'store_default',
  "customerId" TEXT,
  "sessionId" TEXT,
  "deviceId" TEXT,
  "context" TEXT NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'RULES',
  "eventType" TEXT NOT NULL,
  "productId" TEXT,
  "recommendedProductId" TEXT NOT NULL,
  "reason" TEXT,
  "score" DECIMAL(10,3) NOT NULL DEFAULT 0,
  "orderId" TEXT,
  "cartId" TEXT,
  "metadata" JSONB,
  "convertedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "recommendation_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "recommendation_events_tenantId_storeId_context_createdAt_idx" ON "recommendation_events"("tenantId", "storeId", "context", "createdAt");
CREATE INDEX "recommendation_events_tenantId_storeId_eventType_createdAt_idx" ON "recommendation_events"("tenantId", "storeId", "eventType", "createdAt");
CREATE INDEX "recommendation_events_tenantId_customerId_createdAt_idx" ON "recommendation_events"("tenantId", "customerId", "createdAt");
CREATE INDEX "recommendation_events_recommendedProductId_eventType_idx" ON "recommendation_events"("recommendedProductId", "eventType");
