-- Recuperacao de senha do cliente (storefront) por e-mail, mesmo padrao do admin:
-- resetTokenHash guarda o hash (sha256) do token enviado por e-mail, nunca o valor em si.
ALTER TABLE "customers" ADD COLUMN "resetTokenHash" TEXT;
ALTER TABLE "customers" ADD COLUMN "resetTokenExpiresAt" TIMESTAMP(3);
