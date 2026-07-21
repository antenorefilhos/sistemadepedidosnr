CREATE TABLE "payment_transactions" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL DEFAULT 'tenant_default',
  "storeId" TEXT NOT NULL DEFAULT 'store_default',
  "orderId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "method" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "amount" DECIMAL(10, 2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'BRL',
  "providerRef" TEXT,
  "idempotencyKey" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "payment_transactions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "payment_events" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL DEFAULT 'tenant_default',
  "storeId" TEXT NOT NULL DEFAULT 'store_default',
  "transactionId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "signatureOk" BOOLEAN NOT NULL DEFAULT false,
  "providerEventId" TEXT,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payment_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "refunds" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL DEFAULT 'tenant_default',
  "storeId" TEXT NOT NULL DEFAULT 'store_default',
  "orderId" TEXT NOT NULL,
  "transactionId" TEXT,
  "status" TEXT NOT NULL,
  "amount" DECIMAL(10, 2) NOT NULL,
  "reason" TEXT NOT NULL,
  "providerRef" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "refunds_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "payment_reconciliation_runs" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL DEFAULT 'tenant_default',
  "storeId" TEXT NOT NULL DEFAULT 'store_default',
  "provider" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'COMPLETED',
  "periodStart" TIMESTAMP(3) NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL,
  "matchedCount" INTEGER NOT NULL DEFAULT 0,
  "missingProviderCount" INTEGER NOT NULL DEFAULT 0,
  "missingLocalCount" INTEGER NOT NULL DEFAULT 0,
  "amountMismatchCount" INTEGER NOT NULL DEFAULT 0,
  "totalDifference" DECIMAL(10, 2) NOT NULL DEFAULT 0,
  "report" JSONB NOT NULL,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "payment_reconciliation_runs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "payment_transactions_provider_providerRef_key" ON "payment_transactions"("provider", "providerRef");
CREATE UNIQUE INDEX "payment_transactions_tenantId_storeId_idempotencyKey_key" ON "payment_transactions"("tenantId", "storeId", "idempotencyKey");
CREATE INDEX "payment_transactions_tenantId_storeId_orderId_idx" ON "payment_transactions"("tenantId", "storeId", "orderId");
CREATE INDEX "payment_transactions_tenantId_storeId_status_createdAt_idx" ON "payment_transactions"("tenantId", "storeId", "status", "createdAt");
CREATE INDEX "payment_transactions_provider_status_createdAt_idx" ON "payment_transactions"("provider", "status", "createdAt");

CREATE UNIQUE INDEX "payment_events_transactionId_providerEventId_key" ON "payment_events"("transactionId", "providerEventId");
CREATE INDEX "payment_events_tenantId_storeId_type_receivedAt_idx" ON "payment_events"("tenantId", "storeId", "type", "receivedAt");
CREATE INDEX "payment_events_transactionId_receivedAt_idx" ON "payment_events"("transactionId", "receivedAt");

CREATE INDEX "refunds_tenantId_storeId_orderId_createdAt_idx" ON "refunds"("tenantId", "storeId", "orderId", "createdAt");
CREATE INDEX "refunds_tenantId_storeId_status_createdAt_idx" ON "refunds"("tenantId", "storeId", "status", "createdAt");
CREATE INDEX "refunds_transactionId_idx" ON "refunds"("transactionId");

CREATE INDEX "payment_reconciliation_runs_tenantId_storeId_provider_periodStart_periodEnd_idx" ON "payment_reconciliation_runs"("tenantId", "storeId", "provider", "periodStart", "periodEnd");
CREATE INDEX "payment_reconciliation_runs_tenantId_storeId_status_createdAt_idx" ON "payment_reconciliation_runs"("tenantId", "storeId", "status", "createdAt");

ALTER TABLE "payment_events"
  ADD CONSTRAINT "payment_events_transactionId_fkey"
  FOREIGN KEY ("transactionId") REFERENCES "payment_transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "refunds"
  ADD CONSTRAINT "refunds_transactionId_fkey"
  FOREIGN KEY ("transactionId") REFERENCES "payment_transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
