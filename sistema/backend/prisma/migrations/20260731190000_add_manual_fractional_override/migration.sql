-- Override manual de fracionamento: usado somente como fallback quando o ERP
-- (Solidcom) nao informa isFractional/fractionStep para o produto. Nunca
-- sobrescreve o dado do ERP -- e um preenchimento de lacuna sob controle do
-- lojista, e serve de base de continuidade caso o ERP mude no futuro.
ALTER TABLE "products"
ADD COLUMN "manualIsFractional" BOOLEAN,
ADD COLUMN "manualFractionStep" DOUBLE PRECISION;

ALTER TABLE "products"
ADD CONSTRAINT "products_manual_fraction_step_required_for_manual_fractional"
CHECK (
  "manualIsFractional" IS NOT TRUE
  OR (
    "manualFractionStep" IS NOT NULL
    AND "manualFractionStep" > 0
  )
);
