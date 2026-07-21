const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

const requiredColumns = {
  payment_transactions: [
    'tenantId',
    'storeId',
    'orderId',
    'provider',
    'method',
    'status',
    'amount',
    'currency',
    'providerRef',
    'idempotencyKey',
    'metadata',
    'createdAt',
    'updatedAt',
  ],
  payment_events: [
    'tenantId',
    'storeId',
    'transactionId',
    'type',
    'payload',
    'signatureOk',
    'providerEventId',
    'receivedAt',
  ],
  refunds: [
    'tenantId',
    'storeId',
    'orderId',
    'transactionId',
    'status',
    'amount',
    'reason',
    'providerRef',
    'createdAt',
    'updatedAt',
  ],
  payment_reconciliation_runs: [
    'tenantId',
    'storeId',
    'provider',
    'status',
    'periodStart',
    'periodEnd',
    'matchedCount',
    'missingProviderCount',
    'missingLocalCount',
    'amountMismatchCount',
    'totalDifference',
    'report',
    'createdBy',
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

  await assertIndex('payment_transactions', 'payment_transactions_provider_providerRef_key')
  await assertIndex('payment_transactions', 'payment_transactions_tenantId_storeId_idempotencyKey_key')
  await assertIndex('payment_transactions', 'payment_transactions_tenantId_storeId_orderId_idx')
  await assertIndex('payment_transactions', 'payment_transactions_tenantId_storeId_status_createdAt_idx')
  await assertIndex('payment_events', 'payment_events_transactionId_providerEventId_key')
  await assertIndex('payment_events', 'payment_events_tenantId_storeId_type_receivedAt_idx')
  await assertIndex('refunds', 'refunds_tenantId_storeId_orderId_createdAt_idx')
  await assertIndexColumns('payment_reconciliation_runs', ['"tenantId"', '"storeId"', 'provider', '"periodStart"', '"periodEnd"'])
  await assertIndexColumns('payment_reconciliation_runs', ['"tenantId"', '"storeId"', 'status', '"createdAt"'])

  await Promise.all([
    prisma.paymentTransaction.count(),
    prisma.paymentEvent.count(),
    prisma.refund.count(),
    prisma.paymentReconciliationRun.count(),
  ])

  console.log('Payments foundation valid')
}

main()
  .catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
