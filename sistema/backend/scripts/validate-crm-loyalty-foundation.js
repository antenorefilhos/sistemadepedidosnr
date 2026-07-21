const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

const requiredColumns = {
  customer_profiles: ['tenantId', 'storeId', 'customerId', 'ltv', 'orderCount', 'averageTicket', 'lastOrderAt', 'churnRiskScore'],
  customer_consents: ['tenantId', 'storeId', 'customerId', 'type', 'status', 'source'],
  customer_segments: ['tenantId', 'storeId', 'name', 'key', 'rules', 'status', 'refreshedAt'],
  customer_segment_members: ['tenantId', 'storeId', 'segmentId', 'customerId', 'reason', 'score'],
  loyalty_accounts: ['tenantId', 'storeId', 'customerId', 'points', 'cashback', 'tier', 'expiresAt'],
  loyalty_ledger: ['tenantId', 'storeId', 'accountId', 'customerId', 'type', 'pointsDelta', 'cashbackDelta', 'pointsBalance', 'cashbackBalance', 'referenceType', 'referenceId', 'reason'],
  campaigns: ['tenantId', 'storeId', 'name', 'channel', 'segmentId', 'template', 'status'],
  campaign_deliveries: ['tenantId', 'storeId', 'campaignId', 'customerId', 'channel', 'status', 'payload', 'consentId'],
  shopping_lists: ['tenantId', 'storeId', 'customerId', 'name', 'source', 'status'],
  shopping_list_items: ['listId', 'productId', 'quantity', 'sortOrder'],
}

async function assertTableColumns(tableName, columns) {
  const rows = await prisma.$queryRaw`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = ${tableName}
  `
  const found = new Set(rows.map((row) => row.column_name))
  const missing = columns.filter((column) => !found.has(column))
  if (missing.length > 0) {
    throw new Error(`${tableName} missing columns: ${missing.join(', ')}`)
  }
}

async function assertIndex(tableName, indexName) {
  const rows = await prisma.$queryRaw`
    SELECT indexname
    FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = ${tableName} AND indexname = ${indexName}
  `
  if (rows.length === 0) {
    throw new Error(`${tableName} missing index: ${indexName}`)
  }
}

async function main() {
  for (const [tableName, columns] of Object.entries(requiredColumns)) {
    await assertTableColumns(tableName, columns)
  }

  await assertIndex('customer_profiles', 'customer_profiles_tenantId_customerId_key')
  await assertIndex('customer_consents', 'customer_consents_tenantId_customerId_type_key')
  await assertIndex('customer_segments', 'customer_segments_tenantId_key_key')
  await assertIndex('loyalty_accounts', 'loyalty_accounts_tenantId_customerId_key')
  await assertIndex('campaign_deliveries', 'campaign_deliveries_tenantId_storeId_status_createdAt_idx')
  await assertIndex('shopping_list_items', 'shopping_list_items_listId_productId_key')

  await Promise.all([
    prisma.customerProfile.count(),
    prisma.customerConsent.count(),
    prisma.customerSegment.count(),
    prisma.loyaltyAccount.count(),
    prisma.loyaltyLedger.count(),
    prisma.campaign.count(),
    prisma.campaignDelivery.count(),
    prisma.shoppingList.count(),
  ])

  console.log('CRM loyalty foundation valid')
}

main()
  .catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
