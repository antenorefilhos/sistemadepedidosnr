-- Campos que faltavam pra StoreBanner cobrir 100% do que PromoBanner tinha --
ALTER TABLE "store_banners_cms" ADD COLUMN "highlightNote" TEXT;
ALTER TABLE "store_banners_cms" ADD COLUMN "align" TEXT NOT NULL DEFAULT 'left';
