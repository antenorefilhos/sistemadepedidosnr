-- Deduplicacao de produtos ERP com multiplos EANs (mesmo id_produto) --
ALTER TABLE "products" ADD COLUMN "erpProductId" INTEGER;
ALTER TABLE "products" ADD COLUMN "secondaryEans" TEXT[] NOT NULL DEFAULT '{}';

CREATE INDEX "products_tenantId_erpProductId_idx" ON "products"("tenantId", "erpProductId");

-- Indice GIN para busca por bipagem em qualquer EAN secundario (secondaryEans @> ARRAY[:q])
CREATE INDEX "products_secondaryEans_gin_idx" ON "products" USING GIN ("secondaryEans");
