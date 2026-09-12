-- JON: carrinho abandonado -- marca quando ja mandamos o lembrete de push,
-- pra cron nao repetir o mesmo carrinho toda hora que rodar.
ALTER TABLE "carts" ADD COLUMN "abandonedNotifiedAt" TIMESTAMP(3);
