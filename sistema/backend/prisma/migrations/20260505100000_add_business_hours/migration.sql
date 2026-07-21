-- AlterTable brand_config: add business hours fields
ALTER TABLE "brand_config"
  ADD COLUMN IF NOT EXISTS "businessHours"  TEXT,
  ADD COLUMN IF NOT EXISTS "openMessage"    TEXT,
  ADD COLUMN IF NOT EXISTS "closedMessage"  TEXT,
  ADD COLUMN IF NOT EXISTS "countdownLabel" TEXT;
