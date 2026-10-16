-- Exclusao de conta (LGPD, 16/10/2026): marca quando o titular (ou o admin a
-- pedido dele) encerrou a conta por anonimizacao. Pedidos nao sao afetados --
-- obrigacao fiscal de guarda continua valendo e nao depende deste campo.
ALTER TABLE "customers" ADD COLUMN "deletedAt" TIMESTAMP(3);
