-- Milestone 12 - CRM, loyalty, campaigns and shopping lists foundation
CREATE TABLE "customer_profiles" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'tenant_default',
    "storeId" TEXT NOT NULL DEFAULT 'store_default',
    "customerId" TEXT NOT NULL,
    "birthDate" TIMESTAMP(3),
    "gender" TEXT,
    "preferences" JSONB,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "ltv" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "orderCount" INTEGER NOT NULL DEFAULT 0,
    "averageTicket" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "lastOrderAt" TIMESTAMP(3),
    "churnRiskScore" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "customer_profiles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "customer_consents" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'tenant_default',
    "storeId" TEXT NOT NULL DEFAULT 'store_default',
    "customerId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "customer_consents_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "customer_segments" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'tenant_default',
    "storeId" TEXT,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "rules" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "refreshedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "customer_segments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "customer_segment_members" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'tenant_default',
    "storeId" TEXT NOT NULL DEFAULT 'store_default',
    "segmentId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "reason" JSONB,
    "score" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "customer_segment_members_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "loyalty_accounts" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'tenant_default',
    "storeId" TEXT NOT NULL DEFAULT 'store_default',
    "customerId" TEXT NOT NULL,
    "points" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "cashback" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "tier" TEXT NOT NULL DEFAULT 'BASIC',
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "loyalty_accounts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "loyalty_ledger" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'tenant_default',
    "storeId" TEXT NOT NULL DEFAULT 'store_default',
    "accountId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "pointsDelta" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "cashbackDelta" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "pointsBalance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "cashbackBalance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "reason" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "loyalty_ledger_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "campaigns" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'tenant_default',
    "storeId" TEXT,
    "name" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "segmentId" TEXT,
    "template" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "campaign_deliveries" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'tenant_default',
    "storeId" TEXT NOT NULL DEFAULT 'store_default',
    "campaignId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "payload" JSONB NOT NULL,
    "consentId" TEXT,
    "lastError" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "campaign_deliveries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "shopping_lists" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'tenant_default',
    "storeId" TEXT NOT NULL DEFAULT 'store_default',
    "customerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "shopping_lists_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "shopping_list_items" (
    "id" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL DEFAULT 1,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "shopping_list_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "customer_profiles_tenantId_customerId_key" ON "customer_profiles"("tenantId", "customerId");
CREATE UNIQUE INDEX "customer_profiles_customerId_key" ON "customer_profiles"("customerId");
CREATE INDEX "customer_profiles_tenantId_storeId_lastOrderAt_idx" ON "customer_profiles"("tenantId", "storeId", "lastOrderAt");
CREATE INDEX "customer_profiles_tenantId_ltv_idx" ON "customer_profiles"("tenantId", "ltv");

CREATE UNIQUE INDEX "customer_consents_tenantId_customerId_type_key" ON "customer_consents"("tenantId", "customerId", "type");
CREATE INDEX "customer_consents_tenantId_storeId_type_status_idx" ON "customer_consents"("tenantId", "storeId", "type", "status");

CREATE UNIQUE INDEX "customer_segments_tenantId_key_key" ON "customer_segments"("tenantId", "key");
CREATE INDEX "customer_segments_tenantId_storeId_status_idx" ON "customer_segments"("tenantId", "storeId", "status");

CREATE UNIQUE INDEX "customer_segment_members_segmentId_customerId_key" ON "customer_segment_members"("segmentId", "customerId");
CREATE INDEX "customer_segment_members_tenantId_storeId_customerId_idx" ON "customer_segment_members"("tenantId", "storeId", "customerId");

CREATE UNIQUE INDEX "loyalty_accounts_tenantId_customerId_key" ON "loyalty_accounts"("tenantId", "customerId");
CREATE UNIQUE INDEX "loyalty_accounts_customerId_key" ON "loyalty_accounts"("customerId");
CREATE INDEX "loyalty_accounts_tenantId_storeId_tier_idx" ON "loyalty_accounts"("tenantId", "storeId", "tier");

CREATE INDEX "loyalty_ledger_tenantId_storeId_customerId_createdAt_idx" ON "loyalty_ledger"("tenantId", "storeId", "customerId", "createdAt");
CREATE INDEX "loyalty_ledger_accountId_createdAt_idx" ON "loyalty_ledger"("accountId", "createdAt");
CREATE INDEX "loyalty_ledger_referenceType_referenceId_idx" ON "loyalty_ledger"("referenceType", "referenceId");

CREATE INDEX "campaigns_tenantId_storeId_channel_status_idx" ON "campaigns"("tenantId", "storeId", "channel", "status");
CREATE INDEX "campaigns_segmentId_status_idx" ON "campaigns"("segmentId", "status");

CREATE INDEX "campaign_deliveries_tenantId_storeId_status_createdAt_idx" ON "campaign_deliveries"("tenantId", "storeId", "status", "createdAt");
CREATE INDEX "campaign_deliveries_campaignId_customerId_idx" ON "campaign_deliveries"("campaignId", "customerId");

CREATE INDEX "shopping_lists_tenantId_storeId_customerId_status_idx" ON "shopping_lists"("tenantId", "storeId", "customerId", "status");
CREATE UNIQUE INDEX "shopping_list_items_listId_productId_key" ON "shopping_list_items"("listId", "productId");
CREATE INDEX "shopping_list_items_productId_idx" ON "shopping_list_items"("productId");

ALTER TABLE "customer_profiles" ADD CONSTRAINT "customer_profiles_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "customer_consents" ADD CONSTRAINT "customer_consents_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "customer_segment_members" ADD CONSTRAINT "customer_segment_members_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "customer_segments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "loyalty_accounts" ADD CONSTRAINT "loyalty_accounts_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "loyalty_ledger" ADD CONSTRAINT "loyalty_ledger_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "loyalty_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "customer_segments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "campaign_deliveries" ADD CONSTRAINT "campaign_deliveries_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "campaign_deliveries" ADD CONSTRAINT "campaign_deliveries_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "shopping_lists" ADD CONSTRAINT "shopping_lists_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "shopping_list_items" ADD CONSTRAINT "shopping_list_items_listId_fkey" FOREIGN KEY ("listId") REFERENCES "shopping_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;
