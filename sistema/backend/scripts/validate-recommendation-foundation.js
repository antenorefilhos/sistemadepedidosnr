const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

const requiredColumns = {
  recommendation_events: [
    'tenantId',
    'storeId',
    'customerId',
    'sessionId',
    'deviceId',
    'context',
    'source',
    'eventType',
    'productId',
    'recommendedProductId',
    'reason',
    'score',
    'orderId',
    'cartId',
    'metadata',
    'convertedAt',
  ],
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
    WHERE schemaname = 'public' AND tablename = ${tableName}
  `
  const prefix = indexName.slice(0, 60)
  const found = rows.some((row) => row.indexname === indexName || row.indexname.startsWith(prefix))
  if (!found) {
    throw new Error(`${tableName} missing index: ${indexName}`)
  }
}

async function main() {
  for (const [tableName, columns] of Object.entries(requiredColumns)) {
    await assertTableColumns(tableName, columns)
  }

  await assertIndex('recommendation_events', 'recommendation_events_tenantId_storeId_context_createdAt_idx')
  await assertIndex('recommendation_events', 'recommendation_events_tenantId_storeId_eventType_createdAt_idx')
  await assertIndex('recommendation_events', 'recommendation_events_recommendedProductId_eventType_idx')

  await Promise.all([
    prisma.recommendationEvent.count(),
    prisma.analyticsEvent.count({ where: { type: { startsWith: 'RECOMMENDATION_' } } }),
  ])

  console.log('Recommendation intelligence foundation valid')
}

main()
  .catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
