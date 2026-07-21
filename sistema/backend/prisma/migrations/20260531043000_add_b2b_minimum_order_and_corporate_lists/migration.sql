-- M19 B2B operational completion: minimum order and corporate shopping lists
ALTER TABLE "business_accounts"
ADD COLUMN "minimumOrder" DECIMAL(10, 2);

ALTER TABLE "shopping_lists"
ADD COLUMN "businessAccountId" TEXT;

CREATE INDEX "shopping_lists_tenantId_storeId_businessAccountId_status_idx"
ON "shopping_lists"("tenantId", "storeId", "businessAccountId", "status");

ALTER TABLE "shopping_lists"
ADD CONSTRAINT "shopping_lists_businessAccountId_fkey"
FOREIGN KEY ("businessAccountId")
REFERENCES "business_accounts"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;
