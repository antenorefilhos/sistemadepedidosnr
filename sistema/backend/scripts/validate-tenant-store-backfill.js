const { Client } = require('pg')

const requiredTenantTables = [
  'admins',
  'customers',
  'addresses',
  'products',
  'orders',
  'order_items',
  'idempotency_keys',
  'categories_cms',
  'product_category_mappings',
  'category_classification_mappings',
  'category_product_curations_cms',
  'hero_slides_cms',
  'promo_banners_cms',
  'store_banners_cms',
  'push_subscriptions',
  'audit_logs',
  'recipe_categories',
  'recipes',
  'brand_config',
  'integration_module_configs',
  'fraud_logs',
  'delivery_zones',
  'notifications',
  'analytics_events',
  'alert_rules',
  'classification_rules',
  'category_mapping_pending',
]

const requiredStoreTables = [
  'products',
  'orders',
  'order_items',
  'idempotency_keys',
  'hero_slides_cms',
  'promo_banners_cms',
  'store_banners_cms',
  'brand_config',
  'delivery_zones',
]

async function countMissing(client, table, column) {
  const result = await client.query(
    `SELECT COUNT(*)::int AS count FROM "${table}" WHERE "${column}" IS NULL OR "${column}" = ''`,
  )
  return result.rows[0].count
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required')
  }

  const client = new Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()

  const failures = []
  for (const table of requiredTenantTables) {
    const count = await countMissing(client, table, 'tenantId')
    if (count > 0) failures.push(`${table}.tenantId=${count}`)
  }

  for (const table of requiredStoreTables) {
    const count = await countMissing(client, table, 'storeId')
    if (count > 0) failures.push(`${table}.storeId=${count}`)
  }

  await client.end()

  if (failures.length > 0) {
    console.error(`tenant/store backfill invalid: ${failures.join(', ')}`)
    process.exit(1)
  }

  console.log('tenant/store backfill valid')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
