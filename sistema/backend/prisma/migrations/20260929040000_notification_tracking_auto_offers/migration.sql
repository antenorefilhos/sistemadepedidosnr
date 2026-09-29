-- Rastreio de clique/lote dos avisos e configuracao do algoritmo de ofertas (29/09/2026).
ALTER TABLE "notifications" ADD COLUMN "clickedAt" TIMESTAMP(3);
ALTER TABLE "notifications" ADD COLUMN "batchId" TEXT;
ALTER TABLE "notifications" ADD COLUMN "source" TEXT;
CREATE INDEX "notifications_batchId_idx" ON "notifications"("batchId");
-- Historico: avisos de promocao antigos vieram do ciclo automatico (IA).
UPDATE "notifications" SET "source" = CASE WHEN "type" = 'ORDER_UPDATE' THEN 'ORDER' ELSE 'MANUAL' END;
CREATE TABLE "auto_offer_settings" (
  "id" TEXT NOT NULL DEFAULT 'singleton',
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "minDiscount" INTEGER NOT NULL DEFAULT 15,
  "maxPerWeek" INTEGER NOT NULL DEFAULT 3,
  "sendHours" TEXT NOT NULL DEFAULT '11,17',
  "learnedWeights" JSONB,
  "lastRunAt" TIMESTAMP(3),
  "lastRunSummary" JSONB,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "auto_offer_settings_pkey" PRIMARY KEY ("id")
);
