-- Evolucao do StoreBanner para o modulo unificado de espacos publicitarios --
ALTER TABLE "store_banners_cms" RENAME COLUMN "type" TO "slot";
ALTER TABLE "store_banners_cms" RENAME COLUMN "imageUrl" TO "desktopImageUrl";
ALTER TABLE "store_banners_cms" RENAME COLUMN "scheduledStart" TO "startDate";
ALTER TABLE "store_banners_cms" RENAME COLUMN "scheduledEnd" TO "endDate";

ALTER TABLE "store_banners_cms" ADD COLUMN "targetCategory" TEXT;
ALTER TABLE "store_banners_cms" ADD COLUMN "description" TEXT;
ALTER TABLE "store_banners_cms" ADD COLUMN "badgeText" TEXT;
ALTER TABLE "store_banners_cms" ADD COLUMN "ctaLabel" TEXT;
ALTER TABLE "store_banners_cms" ADD COLUMN "overlayColor" TEXT;
ALTER TABLE "store_banners_cms" ADD COLUMN "linkType" TEXT NOT NULL DEFAULT 'url';
ALTER TABLE "store_banners_cms" ADD COLUMN "linkValue" TEXT;
ALTER TABLE "store_banners_cms" ADD COLUMN "sponsorName" TEXT;
ALTER TABLE "store_banners_cms" ADD COLUMN "impressionsCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "store_banners_cms" ADD COLUMN "clicksCount" INTEGER NOT NULL DEFAULT 0;

-- Migra o link cru existente para o novo par linkType/linkValue (tudo era URL antes)
UPDATE "store_banners_cms" SET "linkValue" = "link" WHERE "link" IS NOT NULL;
ALTER TABLE "store_banners_cms" DROP COLUMN "link";

-- Remapeia o vocabulario antigo de "type" para o novo de "slot": full (carrossel
-- da Home) vira hero; vitrine/mini/lateral (posicoes intercaladas no feed) viram
-- intercalado; tarja mantem o proprio nome.
UPDATE "store_banners_cms" SET "slot" = 'hero' WHERE "slot" = 'full';
UPDATE "store_banners_cms" SET "slot" = 'intercalado' WHERE "slot" IN ('vitrine', 'mini', 'lateral');

CREATE INDEX "store_banners_cms_tenantId_storeId_slot_active_order_idx" ON "store_banners_cms"("tenantId", "storeId", "slot", "active", "order");
DROP INDEX IF EXISTS "store_banners_cms_tenantId_storeId_active_order_idx";
