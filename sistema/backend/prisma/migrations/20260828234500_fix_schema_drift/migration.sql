-- Fecha o desvio entre o schema.prisma e o banco de producao que tinha efeito
-- real. Achado com:
--   npx prisma migrate diff --from-schema-datasource prisma/schema.prisma \
--                           --to-schema-datamodel prisma/schema.prisma --script
--
-- Esse comando e o "check-env.js" do banco: `prisma migrate deploy` compara
-- migrations aplicadas, NAO o schema com o banco, entao um model editado sem
-- migration passa batido em todo deploy. Foi assim que `drivers.adminId` ficou
-- meses ausente e deixou o app do entregador inutilizavel.
--
-- O diff apontou 22 divergencias. Esta migration aplica so as DUAS com efeito
-- funcional; o resto e ruido deliberadamente ignorado (ver nota no fim).

-- 1) UNIQUE que o schema declara e o banco nao tinha.
-- Sem ele, um cliente podia acabar em dois segmentos-membro simultaneos e a
-- segmentacao passaria a contar gente duas vezes, calada. Zero duplicata hoje
-- (tabela vazia), entao criar e seguro.
CREATE UNIQUE INDEX IF NOT EXISTS "customer_segment_members_customerId_key"
  ON "customer_segment_members"("customerId");

-- 2) FK de parada de entrega -> pedido, que o schema declara e o banco nao
-- tinha. Sem ela, apagar um pedido deixava paradas orfas apontando pra nada, e
-- o app do entregador abriria uma parada sem pedido. Direto no caminho que
-- vamos exercitar agora. Zero orfao hoje, entao a constraint entra sem limpeza.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'delivery_stops_orderId_fkey'
      AND table_name = 'delivery_stops'
  ) THEN
    ALTER TABLE "delivery_stops"
      ADD CONSTRAINT "delivery_stops_orderId_fkey"
      FOREIGN KEY ("orderId") REFERENCES "orders"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- NAO aplicado de proposito, e por que:
--
-- * DROP INDEX products_secondaryEans_gin_idx e store_banners_cms_campaignErpId_idx
--   -- o banco TEM esses indices e o schema nao os declara. O diff quer
--   derrubar; derrubar seria perder desempenho de busca por EAN secundario que
--   alguem criou de proposito. A correcao certa e o schema passar a declara-los,
--   nao o banco perde-los. Feito no schema.prisma junto deste commit.
--
-- * ALTER COLUMN "updatedAt" DROP DEFAULT em 10 tabelas -- o banco tem DEFAULT
--   que o schema nao declara. E mais seguro do que o schema pede (o Prisma ja
--   preenche em codigo); remover so criaria risco de NULL em escrita fora do
--   Prisma.
--
-- * 8 RenameIndex -- diferenca de truncagem de nome do Prisma. Zero efeito.
--
-- * store_banners_cms.slot SET DEFAULT 'hero' -- a aplicacao sempre envia slot.
--   Inofensivo nos dois sentidos; nao vale um ALTER em tabela viva.
