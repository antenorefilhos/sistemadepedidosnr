-- JON-138 (Auditoria 360): revogar JWT antigo apos troca/reset de senha.
ALTER TABLE "admins" ADD COLUMN "tokenVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "customers" ADD COLUMN "tokenVersion" INTEGER NOT NULL DEFAULT 0;
