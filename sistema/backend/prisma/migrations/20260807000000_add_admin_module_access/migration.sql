-- Controle de acesso por modulo (Admin / Picking / Delivery) para contas de equipe.
-- role='admin' (master) continua com acesso total via bypass no codigo, independente
-- deste campo -- moduleAccess so importa para contas nao-master.
ALTER TABLE "admins" ADD COLUMN "moduleAccess" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Backfill: preserva o comportamento atual de cada conta existente.
UPDATE "admins" SET "moduleAccess" = ARRAY['admin', 'picking', 'delivery'] WHERE "role" = 'admin';
UPDATE "admins" SET "moduleAccess" = ARRAY['picking'] WHERE "role" = 'picker';
UPDATE "admins" SET "moduleAccess" = ARRAY['delivery'] WHERE "role" = 'driver';
