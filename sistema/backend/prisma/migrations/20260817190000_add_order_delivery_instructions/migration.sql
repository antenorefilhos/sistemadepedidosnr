-- Coluna existe no schema.prisma (Order.deliveryInstructions) desde antes,
-- mas nunca teve migration correspondente -- confirmado que faltava com
-- `prisma migrate status` (dizia "up to date") enquanto o Postgres real
-- nao tinha a coluna, quebrando todo confirm de checkout com
-- "column orders.deliveryInstructions does not exist".
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "deliveryInstructions" TEXT;
