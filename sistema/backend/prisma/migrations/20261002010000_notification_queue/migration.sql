-- Fila de envios (02/10/2026): scheduled_notifications passa a ser a fila de
-- todo aviso de marketing com hora marcada (encarte, oferta, manual).
ALTER TABLE "scheduled_notifications"
  ADD COLUMN "origin" TEXT NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
  ADD COLUMN "sourceKey" TEXT,
  ADD COLUMN "url" TEXT,
  ADD COLUMN "customerIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "audienceLabel" TEXT,
  ADD COLUMN "expiresAt" TIMESTAMP(3),
  ADD COLUMN "respectHours" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "meta" JSONB,
  ADD COLUMN "note" TEXT,
  ADD COLUMN "editedAt" TIMESTAMP(3),
  ADD COLUMN "editedBy" TEXT,
  ADD COLUMN "approvedAt" TIMESTAMP(3),
  ADD COLUMN "approvedBy" TEXT,
  ADD COLUMN "cancelledAt" TIMESTAMP(3),
  ADD COLUMN "cancelledBy" TEXT,
  ADD COLUMN "sentCount" INTEGER,
  ADD COLUMN "batchId" TEXT,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "scheduled_notifications" SET "status" = 'SENT' WHERE "sentAt" IS NOT NULL;

CREATE UNIQUE INDEX "scheduled_notifications_sourceKey_key" ON "scheduled_notifications"("sourceKey");
CREATE INDEX "scheduled_notifications_status_sendAt_idx" ON "scheduled_notifications"("status", "sendAt");

ALTER TABLE "auto_offer_settings"
  ADD COLUMN "encarteEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "encarteApproval" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "offerApproval" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "cartEnabled" BOOLEAN NOT NULL DEFAULT true;
