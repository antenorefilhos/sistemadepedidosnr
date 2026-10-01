-- "Limpar" no sininho da loja (01/10/2026): esconde do cliente sem apagar a
-- linha, que o historico de disparos do admin conta (enviados/abertos).
ALTER TABLE "notifications" ADD COLUMN "hiddenAt" TIMESTAMP(3);
