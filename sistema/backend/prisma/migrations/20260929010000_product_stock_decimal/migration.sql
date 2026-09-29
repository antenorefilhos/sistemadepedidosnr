-- Estoque decimal: item de balanca (kg) com menos de 1 kg era arredondado para 0 e o produto sumia do site.
ALTER TABLE "products" ALTER COLUMN "stock" TYPE DOUBLE PRECISION;
