-- Antifraude (01/10/2026): nota de risco no pedido, grafo de identidade e
-- bloqueio por identificador. Ver modules/fraud/fraud.service.ts.
ALTER TABLE "orders" ADD COLUMN "riskScore" INTEGER;
ALTER TABLE "orders" ADD COLUMN "riskLevel" TEXT;
ALTER TABLE "orders" ADD COLUMN "riskReasons" JSONB;
ALTER TABLE "orders" ADD COLUMN "riskReviewedAt" TIMESTAMP(3);
ALTER TABLE "orders" ADD COLUMN "riskReviewedBy" TEXT;
ALTER TABLE "orders" ADD COLUMN "deviceFingerprint" TEXT;
ALTER TABLE "orders" ADD COLUMN "clientCountry" TEXT;

CREATE TABLE "identity_signals" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL DEFAULT 'tenant_default',
  "customerId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "firstSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "hits" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "identity_signals_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "identity_signals_tenantId_customerId_kind_value_key" ON "identity_signals"("tenantId", "customerId", "kind", "value");
CREATE INDEX "identity_signals_tenantId_kind_value_idx" ON "identity_signals"("tenantId", "kind", "value");

CREATE TABLE "fraud_blocks" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL DEFAULT 'tenant_default',
  "kind" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "reason" TEXT,
  "customerId" TEXT,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "fraud_blocks_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "fraud_blocks_tenantId_kind_value_key" ON "fraud_blocks"("tenantId", "kind", "value");

-- Sinais de quem ja comprou: aparelho e IP real dos pedidos (o IP so passou a
-- ser real em 01/10; os antigos sao do proxy e ficam de fora).
INSERT INTO "identity_signals" ("id", "tenantId", "customerId", "kind", "value", "firstSeen", "lastSeen", "hits")
SELECT 'is_' || md5(o."customerId" || 'DEVICE' || o."deviceId"), o."tenantId", o."customerId", 'DEVICE', o."deviceId", MIN(o."createdAt"), MAX(o."createdAt"), COUNT(*)
FROM "orders" o
WHERE o."deviceId" IS NOT NULL AND o."customerId" IS NOT NULL
GROUP BY o."tenantId", o."customerId", o."deviceId"
ON CONFLICT DO NOTHING;
