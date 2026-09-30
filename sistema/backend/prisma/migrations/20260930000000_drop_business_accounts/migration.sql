-- Contas B2B retiradas (30/09/2026): marco M19 criado em maio so no servidor,
-- nunca usado (zero contas, zero pedidos, zero tabelas de preco). Conferido
-- antes de apagar: todas as colunas abaixo vazias ou no valor padrao.
-- DROP COLUMN leva junto os indices e FKs que dependem da coluna.
ALTER TABLE "orders"
  DROP COLUMN IF EXISTS "businessAccountId",
  DROP COLUMN IF EXISTS "businessApprovalStatus",
  DROP COLUMN IF EXISTS "businessApprovedBy",
  DROP COLUMN IF EXISTS "businessApprovedAt",
  DROP COLUMN IF EXISTS "businessPaymentTerms",
  DROP COLUMN IF EXISTS "businessInvoiceSnapshot";
ALTER TABLE "price_lists" DROP COLUMN IF EXISTS "businessAccountId";
ALTER TABLE "shopping_lists" DROP COLUMN IF EXISTS "businessAccountId";
DROP TABLE IF EXISTS "business_account_users";
DROP TABLE IF EXISTS "business_accounts";
