const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

const requiredColumns = {
  analytics_events: ['tenantId', 'storeId', 'type', 'entity', 'entityId', 'channel', 'source', 'sessionId', 'customerId', 'deviceId', 'metadata', 'createdAt'],
  metric_snapshots: ['tenantId', 'storeId', 'period', 'periodStart', 'periodEnd', 'dashboard', 'metric', 'dimension', 'dimensionValue', 'channel', 'productId', 'category', 'value', 'unit', 'metadata', 'computedAt'],
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

  await assertIndex('analytics_events', 'analytics_events_tenantId_storeId_channel_createdAt_idx')
  await assertIndex('analytics_events', 'analytics_events_tenantId_sessionId_createdAt_idx')
  await assertIndex('metric_snapshots', 'metric_snapshots_unique_scope')
  await assertIndex('metric_snapshots', 'metric_snapshots_tenantId_storeId_dashboard_metric_periodStart_idx')
  await assertIndex('metric_snapshots', 'metric_snapshots_tenantId_storeId_dimension_dimensionValue_periodStart_idx')

  await Promise.all([
    prisma.analyticsEvent.count(),
    prisma.metricSnapshot.count(),
  ])

  console.log('BI analytics foundation valid')
}

main()
  .catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
