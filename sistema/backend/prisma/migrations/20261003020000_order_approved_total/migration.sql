-- Valor que o cliente aprovou no checkout, para mostrar o ajuste da separacao.
ALTER TABLE "orders" ADD COLUMN "approvedSubtotal" DOUBLE PRECISION;
ALTER TABLE "orders" ADD COLUMN "approvedTotal" DOUBLE PRECISION;

-- Pedidos ja existentes: o evento de criacao guardou o que foi aprovado.
UPDATE "orders" o
SET "approvedSubtotal" = (e.payload->>'subtotal')::double precision,
    "approvedTotal" = (e.payload->>'total')::double precision
FROM "order_events" e
WHERE e."orderId" = o.id
  AND e.type = 'order.created'
  AND e.payload ? 'total';
