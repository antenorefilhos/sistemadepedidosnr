-- Milestone 19 - B2B/atacarejo e contas comerciais

CREATE TABLE "business_accounts" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL DEFAULT 'tenant_default',
  "storeId" TEXT NOT NULL DEFAULT 'store_default',
  "name" TEXT NOT NULL,
  "document" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "creditLimit" DECIMAL(12,2),
  "paymentTerms" TEXT,
  "invoiceProfile" JSONB,
  "recurringRules" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "business_accounts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "business_account_users" (
  "accountId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'BUYER',
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "business_account_users_pkey" PRIMARY KEY ("accountId","customerId")
);

ALTER TABLE "price_lists" ADD COLUMN "businessAccountId" TEXT;
ALTER TABLE "orders" ADD COLUMN "businessAccountId" TEXT;
ALTER TABLE "orders" ADD COLUMN "businessApprovalStatus" TEXT NOT NULL DEFAULT 'NOT_REQUIRED';
ALTER TABLE "orders" ADD COLUMN "businessApprovedBy" TEXT;
ALTER TABLE "orders" ADD COLUMN "businessApprovedAt" TIMESTAMP(3);
ALTER TABLE "orders" ADD COLUMN "businessPaymentTerms" TEXT;
ALTER TABLE "orders" ADD COLUMN "businessInvoiceSnapshot" JSONB;

CREATE UNIQUE INDEX "business_accounts_tenantId_document_key" ON "business_accounts"("tenantId", "document");
CREATE INDEX "business_accounts_tenantId_storeId_status_idx" ON "business_accounts"("tenantId", "storeId", "status");
CREATE INDEX "business_account_users_customerId_status_idx" ON "business_account_users"("customerId", "status");
CREATE INDEX "price_lists_tenantId_businessAccountId_idx" ON "price_lists"("tenantId", "businessAccountId");
CREATE INDEX "orders_tenantId_storeId_businessAccountId_businessApprovalStatus_idx" ON "orders"("tenantId", "storeId", "businessAccountId", "businessApprovalStatus");

ALTER TABLE "business_account_users"
  ADD CONSTRAINT "business_account_users_accountId_fkey"
  FOREIGN KEY ("accountId") REFERENCES "business_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "business_account_users"
  ADD CONSTRAINT "business_account_users_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "price_lists"
  ADD CONSTRAINT "price_lists_businessAccountId_fkey"
  FOREIGN KEY ("businessAccountId") REFERENCES "business_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "orders"
  ADD CONSTRAINT "orders_businessAccountId_fkey"
  FOREIGN KEY ("businessAccountId") REFERENCES "business_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
