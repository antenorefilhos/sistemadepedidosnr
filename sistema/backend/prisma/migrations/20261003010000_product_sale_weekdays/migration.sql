-- Dias de venda do produto (pizza com assadeira so de quinta a domingo).
ALTER TABLE "products" ADD COLUMN "saleWeekdays" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[];
