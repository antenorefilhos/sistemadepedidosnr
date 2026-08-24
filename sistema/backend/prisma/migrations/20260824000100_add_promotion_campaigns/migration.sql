-- Encartes/campanhas promocionais do ERP Solidcom --
CREATE TABLE "promotion_campaigns" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'tenant_default',
    "storeId" TEXT NOT NULL DEFAULT 'store_default',
    "erpCampaignId" INTEGER,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'encarte',
    "bannerUrl" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "highlightInHome" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "promotion_campaigns_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "promotion_campaigns_erpCampaignId_key" ON "promotion_campaigns"("erpCampaignId");
CREATE INDEX "promotion_campaigns_tenantId_storeId_active_startDate_endD_idx" ON "promotion_campaigns"("tenantId", "storeId", "active", "startDate", "endDate");

CREATE TABLE "promotion_campaign_items" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "ean" TEXT NOT NULL,
    "regularPrice" DECIMAL(10,2) NOT NULL,
    "promotionalPrice" DECIMAL(10,2) NOT NULL,
    "discountPercent" DECIMAL(5,2),
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "promotion_campaign_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "promotion_campaign_items_campaignId_productId_key" ON "promotion_campaign_items"("campaignId", "productId");
CREATE INDEX "promotion_campaign_items_campaignId_order_idx" ON "promotion_campaign_items"("campaignId", "order");

ALTER TABLE "promotion_campaign_items" ADD CONSTRAINT "promotion_campaign_items_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "promotion_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "promotion_campaign_items" ADD CONSTRAINT "promotion_campaign_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
