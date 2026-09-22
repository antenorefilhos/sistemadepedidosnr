-- JON-204: vitrine dedicada a fornecedor/parceria, cadastrada direto no
-- admin (sem depender de encarte sincronizado do ERP).
CREATE TABLE "sponsored_shelves" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'tenant_default',
    "storeId" TEXT NOT NULL DEFAULT 'store_default',
    "title" TEXT NOT NULL,
    "sponsorName" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sponsored_shelves_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sponsored_shelf_items" (
    "id" TEXT NOT NULL,
    "shelfId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "sponsored_shelf_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "sponsored_shelves_tenantId_storeId_active_priority_idx" ON "sponsored_shelves"("tenantId", "storeId", "active", "priority");

CREATE UNIQUE INDEX "sponsored_shelf_items_shelfId_productId_key" ON "sponsored_shelf_items"("shelfId", "productId");

CREATE INDEX "sponsored_shelf_items_shelfId_order_idx" ON "sponsored_shelf_items"("shelfId", "order");

ALTER TABLE "sponsored_shelf_items" ADD CONSTRAINT "sponsored_shelf_items_shelfId_fkey" FOREIGN KEY ("shelfId") REFERENCES "sponsored_shelves"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sponsored_shelf_items" ADD CONSTRAINT "sponsored_shelf_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
