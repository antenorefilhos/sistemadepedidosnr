-- DropIndex
DROP INDEX "idempotency_keys_scope_key_key";

-- AlterTable
ALTER TABLE "addresses" ADD COLUMN "tenantId" TEXT NOT NULL DEFAULT 'tenant_default';
ALTER TABLE "admins" ADD COLUMN "tenantId" TEXT NOT NULL DEFAULT 'tenant_default';
ALTER TABLE "alert_rules" ADD COLUMN "storeId" TEXT, ADD COLUMN "tenantId" TEXT NOT NULL DEFAULT 'tenant_default';
ALTER TABLE "analytics_events" ADD COLUMN "storeId" TEXT, ADD COLUMN "tenantId" TEXT NOT NULL DEFAULT 'tenant_default';
ALTER TABLE "audit_logs" ADD COLUMN "storeId" TEXT, ADD COLUMN "tenantId" TEXT NOT NULL DEFAULT 'tenant_default';
ALTER TABLE "brand_config" ADD COLUMN "storeId" TEXT NOT NULL DEFAULT 'store_default', ADD COLUMN "tenantId" TEXT NOT NULL DEFAULT 'tenant_default';
ALTER TABLE "categories_cms" ADD COLUMN "tenantId" TEXT NOT NULL DEFAULT 'tenant_default';
ALTER TABLE "category_classification_mappings" ADD COLUMN "tenantId" TEXT NOT NULL DEFAULT 'tenant_default';
ALTER TABLE "category_mapping_pending" ADD COLUMN "tenantId" TEXT NOT NULL DEFAULT 'tenant_default';
ALTER TABLE "category_product_curations_cms" ADD COLUMN "tenantId" TEXT NOT NULL DEFAULT 'tenant_default';
ALTER TABLE "classification_rules" ADD COLUMN "tenantId" TEXT NOT NULL DEFAULT 'tenant_default';
ALTER TABLE "customers" ADD COLUMN "tenantId" TEXT NOT NULL DEFAULT 'tenant_default';
ALTER TABLE "delivery_zones" ADD COLUMN "storeId" TEXT NOT NULL DEFAULT 'store_default', ADD COLUMN "tenantId" TEXT NOT NULL DEFAULT 'tenant_default';
ALTER TABLE "fraud_logs" ADD COLUMN "storeId" TEXT, ADD COLUMN "tenantId" TEXT NOT NULL DEFAULT 'tenant_default';
ALTER TABLE "hero_slides_cms" ADD COLUMN "storeId" TEXT NOT NULL DEFAULT 'store_default', ADD COLUMN "tenantId" TEXT NOT NULL DEFAULT 'tenant_default';
ALTER TABLE "idempotency_keys" ADD COLUMN "storeId" TEXT NOT NULL DEFAULT 'store_default', ADD COLUMN "tenantId" TEXT NOT NULL DEFAULT 'tenant_default';
ALTER TABLE "integration_module_configs" ADD COLUMN "tenantId" TEXT NOT NULL DEFAULT 'tenant_default';
ALTER TABLE "notifications" ADD COLUMN "storeId" TEXT, ADD COLUMN "tenantId" TEXT NOT NULL DEFAULT 'tenant_default';
ALTER TABLE "order_items" ADD COLUMN "storeId" TEXT NOT NULL DEFAULT 'store_default', ADD COLUMN "tenantId" TEXT NOT NULL DEFAULT 'tenant_default';
ALTER TABLE "orders" ADD COLUMN "storeId" TEXT NOT NULL DEFAULT 'store_default', ADD COLUMN "tenantId" TEXT NOT NULL DEFAULT 'tenant_default';
ALTER TABLE "product_category_mappings" ADD COLUMN "tenantId" TEXT NOT NULL DEFAULT 'tenant_default';
ALTER TABLE "products" ADD COLUMN "storeId" TEXT NOT NULL DEFAULT 'store_default', ADD COLUMN "tenantId" TEXT NOT NULL DEFAULT 'tenant_default';
ALTER TABLE "promo_banners_cms" ADD COLUMN "storeId" TEXT NOT NULL DEFAULT 'store_default', ADD COLUMN "tenantId" TEXT NOT NULL DEFAULT 'tenant_default';
ALTER TABLE "push_subscriptions" ADD COLUMN "tenantId" TEXT NOT NULL DEFAULT 'tenant_default';
ALTER TABLE "recipe_categories" ADD COLUMN "tenantId" TEXT NOT NULL DEFAULT 'tenant_default';
ALTER TABLE "recipes" ADD COLUMN "tenantId" TEXT NOT NULL DEFAULT 'tenant_default';
ALTER TABLE "store_banners_cms" ADD COLUMN "storeId" TEXT NOT NULL DEFAULT 'store_default', ADD COLUMN "tenantId" TEXT NOT NULL DEFAULT 'tenant_default';

-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "plan" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "stores" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    "document" TEXT,
    "phone" TEXT,
    "address" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "stores_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tenant_users" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tenant_users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "permissions" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "description" TEXT,
    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "role_permissions" (
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("roleId","permissionId")
);

CREATE TABLE "user_store_access" (
    "userId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    CONSTRAINT "user_store_access_pkey" PRIMARY KEY ("userId","storeId","roleId")
);

-- Seed default tenant/store/RBAC for existing single-store data.
INSERT INTO "tenants" ("id", "name", "slug", "status", "plan", "createdAt", "updatedAt")
VALUES ('tenant_default', 'Antenor e Filhos', 'antenor-e-filhos', 'ACTIVE', 'legacy-single-store', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO "stores" ("id", "tenantId", "name", "code", "status", "timezone", "createdAt", "updatedAt")
VALUES ('store_default', 'tenant_default', 'Loja Principal', 'principal', 'ACTIVE', 'America/Sao_Paulo', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO "roles" ("id", "tenantId", "name", "key", "isSystem")
VALUES ('role_default_admin', 'tenant_default', 'Administrador', 'admin', true);

INSERT INTO "permissions" ("id", "key", "description")
VALUES
  ('perm_orders_read', 'orders.read', 'Ler pedidos'),
  ('perm_orders_write', 'orders.write', 'Criar e editar pedidos'),
  ('perm_orders_cancel', 'orders.cancel', 'Cancelar pedidos'),
  ('perm_orders_refund', 'orders.refund', 'Estornar pedidos'),
  ('perm_picking_read', 'picking.read', 'Ler separacao'),
  ('perm_picking_write', 'picking.write', 'Executar separacao'),
  ('perm_catalog_read', 'catalog.read', 'Ler catalogo'),
  ('perm_catalog_write', 'catalog.write', 'Editar catalogo'),
  ('perm_pricing_read', 'pricing.read', 'Ler precos'),
  ('perm_pricing_write', 'pricing.write', 'Editar precos'),
  ('perm_inventory_read', 'inventory.read', 'Ler estoque'),
  ('perm_inventory_write', 'inventory.write', 'Editar estoque'),
  ('perm_promotions_read', 'promotions.read', 'Ler promocoes'),
  ('perm_promotions_write', 'promotions.write', 'Editar promocoes'),
  ('perm_customers_read', 'customers.read', 'Ler clientes'),
  ('perm_customers_write', 'customers.write', 'Editar clientes'),
  ('perm_crm_write', 'crm.write', 'Editar CRM'),
  ('perm_integrations_read', 'integrations.read', 'Ler integracoes'),
  ('perm_integrations_write', 'integrations.write', 'Editar integracoes'),
  ('perm_settings_write', 'settings.write', 'Editar configuracoes'),
  ('perm_reports_read', 'reports.read', 'Ler relatorios'),
  ('perm_users_manage', 'users.manage', 'Gerenciar usuarios'),
  ('perm_audit_read', 'audit.read', 'Ler auditoria');

INSERT INTO "role_permissions" ("roleId", "permissionId")
SELECT 'role_default_admin', "id"
FROM "permissions"
WHERE "key" IN (
  'orders.read', 'orders.write', 'orders.cancel', 'orders.refund',
  'picking.read', 'picking.write',
  'catalog.read', 'catalog.write',
  'pricing.read', 'pricing.write',
  'inventory.read', 'inventory.write',
  'promotions.read', 'promotions.write',
  'customers.read', 'customers.write',
  'crm.write',
  'integrations.read', 'integrations.write',
  'settings.write',
  'reports.read',
  'users.manage',
  'audit.read'
);

INSERT INTO "tenant_users" ("id", "tenantId", "userId", "status", "createdAt")
SELECT 'tenant_user_' || "id", 'tenant_default', "id", 'ACTIVE', CURRENT_TIMESTAMP
FROM "admins";

INSERT INTO "user_store_access" ("userId", "storeId", "roleId")
SELECT "id", 'store_default', 'role_default_admin'
FROM "admins";

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");
CREATE INDEX "stores_tenantId_status_idx" ON "stores"("tenantId", "status");
CREATE UNIQUE INDEX "stores_tenantId_code_key" ON "stores"("tenantId", "code");
CREATE UNIQUE INDEX "tenant_users_tenantId_userId_key" ON "tenant_users"("tenantId", "userId");
CREATE UNIQUE INDEX "roles_tenantId_key_key" ON "roles"("tenantId", "key");
CREATE UNIQUE INDEX "permissions_key_key" ON "permissions"("key");
CREATE INDEX "addresses_tenantId_customerId_idx" ON "addresses"("tenantId", "customerId");
CREATE INDEX "admins_tenantId_idx" ON "admins"("tenantId");
CREATE INDEX "alert_rules_tenantId_storeId_enabled_idx" ON "alert_rules"("tenantId", "storeId", "enabled");
CREATE INDEX "analytics_events_tenantId_storeId_type_createdAt_idx" ON "analytics_events"("tenantId", "storeId", "type", "createdAt");
CREATE INDEX "audit_logs_tenantId_storeId_createdAt_idx" ON "audit_logs"("tenantId", "storeId", "createdAt");
CREATE INDEX "brand_config_tenantId_storeId_idx" ON "brand_config"("tenantId", "storeId");
CREATE INDEX "categories_cms_tenantId_active_idx" ON "categories_cms"("tenantId", "active");
CREATE INDEX "category_classification_mappings_tenantId_categoryId_idx" ON "category_classification_mappings"("tenantId", "categoryId");
CREATE INDEX "category_mapping_pending_tenantId_status_idx" ON "category_mapping_pending"("tenantId", "status");
CREATE INDEX "category_mapping_pending_tenantId_ean_idx" ON "category_mapping_pending"("tenantId", "ean");
CREATE INDEX "category_product_curations_cms_tenantId_categoryId_idx" ON "category_product_curations_cms"("tenantId", "categoryId");
CREATE INDEX "classification_rules_tenantId_active_idx" ON "classification_rules"("tenantId", "active");
CREATE INDEX "customers_tenantId_idx" ON "customers"("tenantId");
CREATE INDEX "delivery_zones_tenantId_storeId_active_priority_idx" ON "delivery_zones"("tenantId", "storeId", "active", "priority");
CREATE INDEX "fraud_logs_tenantId_storeId_vector_value_idx" ON "fraud_logs"("tenantId", "storeId", "vector", "value");
CREATE INDEX "hero_slides_cms_tenantId_storeId_active_order_idx" ON "hero_slides_cms"("tenantId", "storeId", "active", "order");
CREATE INDEX "idempotency_keys_tenantId_storeId_idx" ON "idempotency_keys"("tenantId", "storeId");
CREATE UNIQUE INDEX "idempotency_keys_tenantId_storeId_scope_key_key" ON "idempotency_keys"("tenantId", "storeId", "scope", "key");
CREATE INDEX "integration_module_configs_tenantId_idx" ON "integration_module_configs"("tenantId");
CREATE INDEX "notifications_tenantId_storeId_customerId_idx" ON "notifications"("tenantId", "storeId", "customerId");
CREATE INDEX "notifications_tenantId_read_idx" ON "notifications"("tenantId", "read");
CREATE INDEX "order_items_tenantId_storeId_idx" ON "order_items"("tenantId", "storeId");
CREATE INDEX "order_items_tenantId_productId_idx" ON "order_items"("tenantId", "productId");
CREATE INDEX "orders_tenantId_storeId_status_idx" ON "orders"("tenantId", "storeId", "status");
CREATE INDEX "orders_tenantId_customerId_idx" ON "orders"("tenantId", "customerId");
CREATE INDEX "orders_tenantId_storeId_createdAt_idx" ON "orders"("tenantId", "storeId", "createdAt");
CREATE INDEX "product_category_mappings_tenantId_ean_idx" ON "product_category_mappings"("tenantId", "ean");
CREATE INDEX "products_tenantId_storeId_active_idx" ON "products"("tenantId", "storeId", "active");
CREATE INDEX "products_tenantId_storeId_category_idx" ON "products"("tenantId", "storeId", "category");
CREATE INDEX "promo_banners_cms_tenantId_storeId_active_order_idx" ON "promo_banners_cms"("tenantId", "storeId", "active", "order");
CREATE INDEX "push_subscriptions_tenantId_customerId_idx" ON "push_subscriptions"("tenantId", "customerId");
CREATE INDEX "recipe_categories_tenantId_active_idx" ON "recipe_categories"("tenantId", "active");
CREATE INDEX "recipes_tenantId_active_idx" ON "recipes"("tenantId", "active");
CREATE INDEX "store_banners_cms_tenantId_storeId_active_order_idx" ON "store_banners_cms"("tenantId", "storeId", "active", "order");

-- AddForeignKey
ALTER TABLE "stores" ADD CONSTRAINT "stores_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tenant_users" ADD CONSTRAINT "tenant_users_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "roles" ADD CONSTRAINT "roles_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_store_access" ADD CONSTRAINT "user_store_access_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_store_access" ADD CONSTRAINT "user_store_access_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
