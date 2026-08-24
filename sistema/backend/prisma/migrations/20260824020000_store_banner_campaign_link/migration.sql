-- Vincula banner a encarte/campanha do Solidcom pelo codigo (sem FK de proposito -- ver comentario no schema)
ALTER TABLE "store_banners_cms" ADD COLUMN "campaignErpId" INTEGER;
CREATE INDEX "store_banners_cms_campaignErpId_idx" ON "store_banners_cms"("campaignErpId");
