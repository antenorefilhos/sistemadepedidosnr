-- Migration: add contactWhatsapp to brand_config
ALTER TABLE "brand_config" ADD COLUMN IF NOT EXISTS "contactWhatsapp" TEXT;
