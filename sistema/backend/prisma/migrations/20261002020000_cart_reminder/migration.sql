-- Lembrete de carrinho pela fila de envios (02/10/2026). O carrinho do site de
-- quem esta logado passa a ficar no servidor; o lembrete antigo (carrinho do
-- checkout) mandava um por tentativa de checkout -- 39 de 43 eram repetidos.
CREATE TABLE "cart_snapshots" (
    "customerId" TEXT NOT NULL,
    "items" JSONB NOT NULL,
    "itemCount" INTEGER NOT NULL,
    "subtotal" DOUBLE PRECISION NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "cart_snapshots_pkey" PRIMARY KEY ("customerId")
);
CREATE INDEX "cart_snapshots_updatedAt_idx" ON "cart_snapshots"("updatedAt");

ALTER TABLE "auto_offer_settings"
  ADD COLUMN "cartApproval" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "cartDelayMinutes" INTEGER NOT NULL DEFAULT 120,
  ADD COLUMN "cartTitle" TEXT NOT NULL DEFAULT '{nome}, esqueceu algo no carrinho?',
  ADD COLUMN "cartBody" TEXT NOT NULL DEFAULT 'Você deixou {itens} no carrinho. Finalize seu pedido!',
  ADD COLUMN "cartImage" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "cartMinTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "cartCooldownDays" INTEGER NOT NULL DEFAULT 3;

ALTER TABLE "carts" DROP COLUMN "abandonedNotifiedAt";
