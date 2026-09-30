-- Vitrine patrocinada passa a contar quantas vezes apareceu (relatorio pro fornecedor, 30/09/2026).
ALTER TABLE "sponsored_shelves" ADD COLUMN IF NOT EXISTS "impressionsCount" INTEGER NOT NULL DEFAULT 0;
