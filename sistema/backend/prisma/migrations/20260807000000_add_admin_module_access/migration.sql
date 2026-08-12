-- "role" nunca foi criada por uma migration formal (entrou no schema.prisma
-- via db push num ambiente de dev, sem historico) -- qualquer banco novo do
-- zero quebrava aqui, ja que as linhas abaixo dependem da coluna existir.
ALTER TABLE "admins" ADD COLUMN IF NOT EXISTS "role" TEXT NOT NULL DEFAULT 'admin';

-- Controle de acesso por modulo (Admin / Picking / Delivery) para contas de equipe.
-- role='admin' (master) continua com acesso total via bypass no codigo, independente
-- deste campo -- moduleAccess so importa para contas nao-master.
ALTER TABLE "admins" ADD COLUMN "moduleAccess" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Backfill: preserva o comportamento atual de cada conta existente.
UPDATE "admins" SET "moduleAccess" = ARRAY['admin', 'picking', 'delivery'] WHERE "role" = 'admin';
UPDATE "admins" SET "moduleAccess" = ARRAY['picking'] WHERE "role" = 'picker';
UPDATE "admins" SET "moduleAccess" = ARRAY['delivery'] WHERE "role" = 'driver';
