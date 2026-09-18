-- JON-184/JON-183: campos enriquecidos do encarte (destaque de capa,
-- sugestao forte, preco por atacado, preco de clube fidelidade). So a
-- AntenorApi manda -- ausentes ficam com o default seguro (false/null).
ALTER TABLE "promotion_campaign_items" ADD COLUMN "highlightCover" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "promotion_campaign_items" ADD COLUMN "strongSuggestion" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "promotion_campaign_items" ADD COLUMN "wholesaleMinQty" INTEGER;
ALTER TABLE "promotion_campaign_items" ADD COLUMN "wholesalePrice" DECIMAL(10,2);
ALTER TABLE "promotion_campaign_items" ADD COLUMN "clubPrice" DECIMAL(10,2);
