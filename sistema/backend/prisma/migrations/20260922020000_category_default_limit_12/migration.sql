-- JON-201: pool de produtos por vitrine sobe de 6 pra 12 (pedido do
-- Jonathan: 10-15 carregados, poucos visiveis de cada vez pelo carrossel).
-- So atualiza quem ainda esta no default original (6) -- categoria que o
-- lojista ja customizou pra outro numero fica intocada.
ALTER TABLE "categories" ALTER COLUMN "limit" SET DEFAULT 12;

UPDATE "categories" SET "limit" = 12 WHERE "limit" = 6;
