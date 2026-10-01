-- Mensagens de aberto/fechado e rotulo do countdown (01/10/2026): o site nunca
-- leu esses campos (a faixa do topo monta o texto a partir do horario) e o
-- admin perdeu os campos de edicao em 28/09. Ficavam gravados sem ninguem ver.
ALTER TABLE "brand_config" DROP COLUMN IF EXISTS "openMessage";
ALTER TABLE "brand_config" DROP COLUMN IF EXISTS "closedMessage";
ALTER TABLE "brand_config" DROP COLUMN IF EXISTS "countdownLabel";
