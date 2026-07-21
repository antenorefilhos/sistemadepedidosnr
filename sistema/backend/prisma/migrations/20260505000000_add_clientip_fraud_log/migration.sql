-- AlterTable orders: add clientIp
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "clientIp" TEXT;

-- CreateTable: fraud_logs
CREATE TABLE IF NOT EXISTS "fraud_logs" (
    "id" TEXT NOT NULL,
    "vector" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "orderId" TEXT,
    "customerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fraud_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "fraud_logs_vector_value_idx" ON "fraud_logs"("vector", "value");
CREATE INDEX IF NOT EXISTS "fraud_logs_createdAt_idx" ON "fraud_logs"("createdAt");
