const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

const requiredColumns = {
  api_clients: [
    'tenantId',
    'storeId',
    'name',
    'clientId',
    'secretHash',
    'scopes',
    'status',
    'rateLimitPerMinute',
    'lastUsedAt',
    'createdAt',
    'updatedAt',
  ],
  webhook_endpoints: [
    'tenantId',
    'storeId',
    'url',
    'secret',
    'events',
    'status',
    'description',
    'createdAt',
    'updatedAt',
  ],
  webhook_deliveries: [
    'tenantId',
    'storeId',
    'endpointId',
    'eventType',
    'payload',
    'status',
    'attempts',
    'maxAttempts',
    'nextRetryAt',
    'lastError',
    'deliveredAt',
    'createdAt',
    'updatedAt',
  ],
  api_usage_logs: [
    'tenantId',
    'storeId',
    'apiClientId',
    'clientId',
    'path',
    'method',
    'statusCode',
    'scope',
    'allowed',
    'error',
    'ip',
    'userAgent',
    'createdAt',
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

  await assertIndex('api_clients', 'api_clients_clientId_key')
  await assertIndex('api_clients', 'api_clients_tenantId_storeId_status_idx')
  await assertIndex('webhook_deliveries', 'webhook_deliveries_tenantId_storeId_status_nextRetryAt_idx')
  await assertIndex('api_usage_logs', 'api_usage_logs_apiClientId_createdAt_idx')

  await Promise.all([
    prisma.apiClient.count(),
    prisma.webhookEndpoint.count(),
    prisma.webhookDelivery.count(),
    prisma.apiUsageLog.count(),
  ])

  console.log('Public API foundation valid')
}

main()
  .catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
