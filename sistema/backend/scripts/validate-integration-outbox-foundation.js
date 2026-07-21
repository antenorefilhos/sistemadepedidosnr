const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

const requiredColumns = {
  integration_connectors: [
    'tenantId',
    'storeId',
    'type',
    'provider',
    'status',
    'config',
    'createdAt',
    'updatedAt',
  ],
  outbox_events: [
    'tenantId',
    'storeId',
    'connectorId',
    'aggregate',
    'aggregateId',
    'type',
    'payload',
    'status',
    'attempts',
    'maxAttempts',
    'idempotencyKey',
    'nextRetryAt',
    'lockedAt',
    'processedAt',
    'lastError',
    'createdAt',
    'updatedAt',
  ],
  integration_jobs: [
    'tenantId',
    'storeId',
    'connectorId',
    'outboxEventId',
    'type',
    'status',
    'payload',
    'result',
    'attempts',
    'error',
    'idempotencyKey',
    'nextRetryAt',
    'startedAt',
    'finishedAt',
    'createdAt',
    'updatedAt',
  ],
  integration_attempts: [
    'tenantId',
    'storeId',
    'jobId',
    'attemptNo',
    'status',
    'requestPayload',
    'responsePayload',
    'error',
    'startedAt',
    'finishedAt',
    'durationMs',
  ],
  integration_dead_letters: [
    'tenantId',
    'storeId',
    'connectorId',
    'outboxEventId',
    'jobId',
    'reason',
    'payload',
    'lastError',
    'replayCount',
    'resolvedAt',
    'createdAt',
    'updatedAt',
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

async function assertIndexColumns(tableName, columns) {
  const rows = await prisma.$queryRaw`
    SELECT indexdef
    FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = ${tableName}
  `
  const found = rows.some((row) => columns.every((column) => row.indexdef.includes(column)))
  if (!found) {
    throw new Error(`${tableName} missing index columns: ${columns.join(', ')}`)
  }
}

async function main() {
  for (const [tableName, columns] of Object.entries(requiredColumns)) {
    await assertTableColumns(tableName, columns)
  }

  await assertIndex('integration_connectors', 'integration_connectors_tenantId_storeId_type_provider_key')
  await assertIndex('outbox_events', 'outbox_events_tenantId_storeId_connectorId_idempotencyKey_key')
  await assertIndex('outbox_events', 'outbox_events_status_nextRetryAt_idx')
  await assertIndexColumns('integration_jobs', ['"tenantId"', '"storeId"', '"connectorId"', '"idempotencyKey"'])
  await assertIndex('integration_attempts', 'integration_attempts_jobId_attemptNo_idx')
  await assertIndexColumns('integration_dead_letters', ['"connectorId"', '"createdAt"'])

  await Promise.all([
    prisma.integrationConnector.count(),
    prisma.outboxEvent.count(),
    prisma.integrationJob.count(),
    prisma.integrationAttempt.count(),
    prisma.integrationDeadLetter.count(),
  ])

  console.log('Integration outbox foundation valid')
}

main()
  .catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
