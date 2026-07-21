-- CreateTable: delivery_zones
CREATE TABLE IF NOT EXISTS "delivery_zones" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'CEP_RANGE',
    "cepStart" TEXT,
    "cepEnd" TEXT,
    "fee" DECIMAL(10,2) NOT NULL,
    "freeAbove" DECIMAL(10,2),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_zones_pkey" PRIMARY KEY ("id")
);
