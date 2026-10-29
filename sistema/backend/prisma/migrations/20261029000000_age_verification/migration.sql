-- AEF-062 (29/10/2026): confirmacao de idade (+18) para categorias de bebida
-- alcoolica e tabacaria.

ALTER TABLE "categories_cms" ADD COLUMN "requiresAgeVerification" BOOLEAN;

ALTER TABLE "products" ADD COLUMN "requiresAgeVerification" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "orders" ADD COLUMN "ageVerificationRequired" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "orders" ADD COLUMN "ageVerificationConfirmedAt" TIMESTAMP(3);
