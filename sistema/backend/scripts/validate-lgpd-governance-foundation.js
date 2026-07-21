const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

const requiredColumns = {
  data_subject_requests: [
    'tenantId',
    'storeId',
    'customerId',
    'type',
    'status',
    'requestedBy',
    'reason',
    'payload',
    'result',
    'executedAt',
  ],
  customer_consents: ['tenantId', 'storeId', 'customerId', 'type', 'status', 'source', 'ip', 'userAgent'],
  audit_logs: ['tenantId', 'storeId', 'action', 'entity', 'entityId', 'adminId', 'changes'],
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

  await assertIndex('data_subject_requests', 'data_subject_requests_tenantId_storeId_customerId_createdAt_idx')
  await assertIndex('data_subject_requests', 'data_subject_requests_tenantId_status_type_idx')

  await Promise.all([
    prisma.dataSubjectRequest.count(),
    prisma.customerConsent.count(),
    prisma.auditLog.count({ where: { action: { startsWith: 'LGPD_' } } }),
  ])

  console.log('LGPD governance foundation valid')
}

main()
  .catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
