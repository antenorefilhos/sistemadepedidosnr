-- Recuperacao de senha do admin por e-mail. resetTokenHash guarda o hash
-- (sha256) do token enviado por e-mail, nunca o valor em si.
ALTER TABLE "admins" ADD COLUMN "resetTokenHash" TEXT;
ALTER TABLE "admins" ADD COLUMN "resetTokenExpiresAt" TIMESTAMP(3);
