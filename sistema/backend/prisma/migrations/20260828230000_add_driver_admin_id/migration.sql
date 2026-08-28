-- Adiciona `drivers.adminId`, que o schema.prisma declara desde sempre e o
-- banco nunca teve.
--
-- Desvio de schema puro: alguem editou o model Driver sem gerar migration, e a
-- coluna so existia no Prisma. Como `prisma migrate deploy` aplica arquivos de
-- migration e nao compara o schema com o banco, isso passou batido em todo
-- deploy -- o "All migrations have been successfully applied" e verdadeiro e
-- irrelevante quando a migration nunca foi escrita.
--
-- Efeito em producao: o app do entregador ficou inteiramente inutilizavel.
-- TODO endpoint de /driver passa por `findDriverByAdmin`, que consulta
-- `where: { adminId }`. Sem a coluna, o Prisma estoura em runtime com
-- "The column `drivers.adminId` does not exist in the current database" -- nao
-- e 404 tratavel, e erro cru logo apos o login.
--
-- O campo e o vinculo entre o perfil de motorista e a conta de acesso: quem
-- recebe o modulo `delivery` na tela de Equipe ganha um Driver via
-- `ensureDriverProfile` (auth.service.ts). Nullable porque motorista pode ser
-- cadastrado sem login (rota operada por alguem que nao usa o app), e UNIQUE
-- porque uma conta nao pode ter dois perfis.

ALTER TABLE "drivers" ADD COLUMN IF NOT EXISTS "adminId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "drivers_adminId_key" ON "drivers"("adminId");
