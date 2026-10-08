-- Troca sugerida pelo separador, decidida pelo cliente (08/10/2026).
CREATE TABLE "substitution_suggestions" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL DEFAULT 'tenant_default',
  "storeId" TEXT NOT NULL DEFAULT 'store_default',
  "orderId" TEXT NOT NULL,
  "orderItemId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "quantity" DECIMAL(12,3) NOT NULL,
  "unitPrice" DECIMAL(10,2) NOT NULL,
  "pickMethod" TEXT,
  "pickedBarcode" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "sentAt" TIMESTAMP(3),
  "decidedAt" TIMESTAMP(3),
  "decidedBy" TEXT,
  "substituteOrderItemId" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "substitution_suggestions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "substitution_suggestions_orderId_status_idx" ON "substitution_suggestions"("orderId", "status");
