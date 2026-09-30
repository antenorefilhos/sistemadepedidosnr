-- Blocos da pagina inicial ocultos pelo lojista (tela Layout do Site, 30/09/2026).
ALTER TABLE "brand_config" ADD COLUMN IF NOT EXISTS "homeLayout" TEXT;
