ALTER TABLE "products"
ADD CONSTRAINT "products_fraction_step_required_for_fractional"
CHECK (
  "isFractional" = false
  OR (
    "fractionStep" IS NOT NULL
    AND "fractionStep" > 0
  )
);
