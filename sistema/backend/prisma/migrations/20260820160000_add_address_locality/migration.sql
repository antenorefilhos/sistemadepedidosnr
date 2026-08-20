-- Localidade/condominio escolhido pelo cliente quando o CEP cobre mais de
-- um ponto da planilha de balcao (ex.: 25750-222 -> "Chafariz"). Sem isso o
-- endereco salvo nunca carregava a escolha, e o pedido chegava no Solidcom
-- so com o bairro generico ("Pedro do Rio"), sem o ponto especifico.
ALTER TABLE "addresses" ADD COLUMN "locality" TEXT;
ALTER TABLE "addresses" ADD COLUMN "deliveryPointCode" TEXT;
