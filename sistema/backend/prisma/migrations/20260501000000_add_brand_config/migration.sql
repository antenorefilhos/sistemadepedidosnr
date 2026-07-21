-- Migration manual: adiciona tabela brand_config (singleton)
CREATE TABLE "brand_config" (
    "id"             TEXT NOT NULL DEFAULT 'singleton',
    "storeName"      TEXT NOT NULL DEFAULT 'Antenor & Filhos',
    "logoDesktopUrl" TEXT,
    "logoMobileUrl"  TEXT,
    "primaryColor"   TEXT NOT NULL DEFAULT '#5D082A',
    "secondaryColor" TEXT NOT NULL DEFAULT '#D2BB8A',
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brand_config_pkey" PRIMARY KEY ("id")
);
