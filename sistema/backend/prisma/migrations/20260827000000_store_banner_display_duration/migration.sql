-- Tempo de exibicao por slide do carrossel hero, em segundos. Default 5 pra
-- manter o comportamento anterior (o auto-advance era fixo em 6.5s, mas 5s e
-- o padrao que o admin oferece e a diferenca nao muda nada pros banners ja
-- cadastrados).
ALTER TABLE "store_banners_cms" ADD COLUMN "displayDuration" INTEGER NOT NULL DEFAULT 5;
