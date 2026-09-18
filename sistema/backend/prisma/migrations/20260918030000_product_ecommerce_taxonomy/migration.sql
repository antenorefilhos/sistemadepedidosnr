-- JON-179/AEF-035: taxonomia canonica da AntenorApi (departamentoEcommerce
-- vira o proprio `category`, decisao do Jonathan de substituir o
-- ProductCategoryMapping quando o ERP mandar esses campos -- Solidcom nao
-- manda, entao o fallback do sync antigo continua valendo pra ele).
ALTER TABLE "products" ADD COLUMN "ecommerceCategory" TEXT;
ALTER TABLE "products" ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
