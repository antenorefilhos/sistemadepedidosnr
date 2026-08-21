-- Bloqueio/suspensao de cliente pelo admin (anti-fraude) --
ALTER TABLE "customers" ADD COLUMN "blocked" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "customers" ADD COLUMN "blockedReason" TEXT;
