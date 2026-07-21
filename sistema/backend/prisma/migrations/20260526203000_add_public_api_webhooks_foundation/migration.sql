-- Milestone 11 - Public API, scoped API clients and signed webhook delivery foundation
CREATE TABLE "api_clients" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'tenant_default',
    "storeId" TEXT NOT NULL DEFAULT 'store_default',
    "name" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "secretHash" TEXT NOT NULL,
    "scopes" TEXT[],
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "rateLimitPerMinute" INTEGER NOT NULL DEFAULT 120,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "api_clients_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "webhook_endpoints" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'tenant_default',
    "storeId" TEXT NOT NULL DEFAULT 'store_default',
    "url" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "events" TEXT[],
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "webhook_endpoints_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "webhook_deliveries" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'tenant_default',
    "storeId" TEXT NOT NULL DEFAULT 'store_default',
    "endpointId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "nextRetryAt" TIMESTAMP(3),
    "lastError" TEXT,
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "webhook_deliveries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "api_usage_logs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'tenant_default',
    "storeId" TEXT NOT NULL DEFAULT 'store_default',
    "apiClientId" TEXT,
    "clientId" TEXT,
    "path" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "statusCode" INTEGER,
    "scope" TEXT,
    "allowed" BOOLEAN NOT NULL DEFAULT false,
    "error" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_usage_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "api_clients_clientId_key" ON "api_clients"("clientId");
CREATE INDEX "api_clients_tenantId_storeId_status_idx" ON "api_clients"("tenantId", "storeId", "status");

CREATE INDEX "webhook_endpoints_tenantId_storeId_status_idx" ON "webhook_endpoints"("tenantId", "storeId", "status");
CREATE INDEX "webhook_endpoints_tenantId_storeId_url_idx" ON "webhook_endpoints"("tenantId", "storeId", "url");

CREATE INDEX "webhook_deliveries_tenantId_storeId_status_nextRetryAt_idx" ON "webhook_deliveries"("tenantId", "storeId", "status", "nextRetryAt");
CREATE INDEX "webhook_deliveries_endpointId_status_createdAt_idx" ON "webhook_deliveries"("endpointId", "status", "createdAt");
CREATE INDEX "webhook_deliveries_eventType_createdAt_idx" ON "webhook_deliveries"("eventType", "createdAt");

CREATE INDEX "api_usage_logs_tenantId_storeId_createdAt_idx" ON "api_usage_logs"("tenantId", "storeId", "createdAt");
CREATE INDEX "api_usage_logs_apiClientId_createdAt_idx" ON "api_usage_logs"("apiClientId", "createdAt");
CREATE INDEX "api_usage_logs_clientId_createdAt_idx" ON "api_usage_logs"("clientId", "createdAt");

ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_endpointId_fkey" FOREIGN KEY ("endpointId") REFERENCES "webhook_endpoints"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "api_usage_logs" ADD CONSTRAINT "api_usage_logs_apiClientId_fkey" FOREIGN KEY ("apiClientId") REFERENCES "api_clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;
