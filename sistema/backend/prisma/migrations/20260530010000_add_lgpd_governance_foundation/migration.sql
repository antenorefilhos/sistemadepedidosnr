CREATE TABLE "data_subject_requests" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL DEFAULT 'tenant_default',
  "storeId" TEXT NOT NULL DEFAULT 'store_default',
  "customerId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "requestedBy" TEXT,
  "reason" TEXT,
  "payload" JSONB,
  "result" JSONB,
  "executedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "data_subject_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "data_subject_requests_tenantId_storeId_customerId_createdAt_idx" ON "data_subject_requests"("tenantId", "storeId", "customerId", "createdAt");
CREATE INDEX "data_subject_requests_tenantId_status_type_idx" ON "data_subject_requests"("tenantId", "status", "type");
