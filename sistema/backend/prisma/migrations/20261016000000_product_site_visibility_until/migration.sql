-- "Ocultar até" (16/10/2026): oculta o produto no site com prazo. Depois de
-- siteVisibilityUntil, o sync para de respeitar o OCULTO sozinho, sem exigir
-- volta manual pelo admin.
ALTER TABLE "products" ADD COLUMN "siteVisibilityUntil" TIMESTAMP(3);
