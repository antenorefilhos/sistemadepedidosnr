-- Microdados do CNEFE (IBGE, Censo 2022) pra geocodificacao local de
-- Petropolis -- cobre servidoes/estradas vicinais que o CEP dos Correios
-- agrupa num unico CEP generico. Populada pelo
-- scripts/import-ibge-cnefe.ts, nao por essa migration.
CREATE TABLE "ibge_addresses" (
    "id" TEXT NOT NULL,
    "cod_unico" TEXT NOT NULL,
    "municipio" TEXT NOT NULL DEFAULT 'Petrópolis',
    "bairro" TEXT NOT NULL,
    "tipo_logradouro" TEXT NOT NULL,
    "nome_logradouro" TEXT NOT NULL,
    "logradouro" TEXT NOT NULL,
    "numero" TEXT,
    "complemento" TEXT,
    "cep" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ibge_addresses_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ibge_addresses_cod_unico_key" ON "ibge_addresses"("cod_unico");
CREATE INDEX "ibge_addresses_cep_idx" ON "ibge_addresses"("cep");
CREATE INDEX "ibge_addresses_bairro_idx" ON "ibge_addresses"("bairro");
CREATE INDEX "ibge_addresses_nome_logradouro_idx" ON "ibge_addresses"("nome_logradouro");
CREATE INDEX "ibge_addresses_latitude_longitude_idx" ON "ibge_addresses"("latitude", "longitude");
