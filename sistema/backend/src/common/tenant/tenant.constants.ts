export const DEFAULT_TENANT_ID = 'tenant_default'
export const DEFAULT_STORE_ID = 'store_default'

export const TENANT_ID_HEADERS = ['x-tenant-id', 'x-internal-tenant-id']
export const STORE_ID_HEADERS = ['x-store-id', 'x-internal-store-id']

export const INITIAL_PERMISSIONS = [
  'orders.read',
  'orders.write',
  'orders.cancel',
  'orders.refund',
  'picking.read',
  'picking.write',
  'catalog.read',
  'catalog.write',
  'pricing.read',
  'pricing.write',
  'inventory.read',
  'inventory.write',
  'promotions.read',
  'promotions.write',
  'customers.read',
  'customers.write',
  'crm.write',
  'integrations.read',
  'integrations.write',
  'settings.write',
  'reports.read',
  'users.manage',
  'audit.read',
] as const
