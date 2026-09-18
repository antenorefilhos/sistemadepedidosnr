-- JON-187: vigencia da promocao, usada pra comparar contra a data da janela
-- de entrega escolhida no checkout (nao a data do pedido).
ALTER TABLE "products" ADD COLUMN "promotionalPriceValidUntil" TIMESTAMP(3);
