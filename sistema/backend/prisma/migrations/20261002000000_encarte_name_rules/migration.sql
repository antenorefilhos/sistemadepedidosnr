-- Nome do encarte para o cliente e aviso de validade proxima (02/10/2026).
ALTER TABLE "promotion_campaigns" ADD COLUMN "customerName" TEXT;
ALTER TABLE "promotion_campaigns" ADD COLUMN "nearExpiry" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "encarte_name_rules" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "nearExpiry" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "encarte_name_rules_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "encarte_name_rules_key_key" ON "encarte_name_rules"("key");

-- Decisao do Jonathan (02/10/2026): o encarte de produtos perto do vencimento
-- aparece como "Ofertas Relampago", com aviso discreto de validade proxima.
INSERT INTO "encarte_name_rules" ("id", "key", "customerName", "nearExpiry", "updatedAt")
VALUES ('rule_validade', 'VALIDADE', 'Ofertas Relâmpago', true, CURRENT_TIMESTAMP);

UPDATE "promotion_campaigns" SET "customerName" = 'Ofertas Relâmpago', "nearExpiry" = true
WHERE upper(trim(regexp_replace("name", '\s+(NR|NV)\s*$', '', 'i'))) = 'VALIDADE';
