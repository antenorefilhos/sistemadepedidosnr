-- Horario escolhido pelo cliente pra receber/retirar o pedido.
-- NULL = "o quanto antes" (vira agora + 15 min na hora combinada do ERP).
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "scheduledFor" TIMESTAMP(3);
