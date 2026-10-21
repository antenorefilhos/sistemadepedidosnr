-- Escalonamento automático de antifraude (16/10/2026): bloqueio automático e
-- temporário de aparelho/rede quando o padrão de abuso aparece sozinho, sem
-- precisar o admin notar e agir manualmente. `automatic` diferencia de
-- bloqueio manual (pelo admin, via tela Clientes/Antifraude); `expiresAt`
-- deixa o bloqueio automático expirar sozinho (NULL = bloqueio manual, sem
-- prazo).
ALTER TABLE "fraud_blocks" ADD COLUMN "automatic" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "fraud_blocks" ADD COLUMN "expiresAt" TIMESTAMP(3);
