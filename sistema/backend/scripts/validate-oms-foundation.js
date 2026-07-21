const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

const requiredColumns = {
  orders: ['tenantId', 'storeId', 'channel', 'fulfillmentType', 'paymentStatus', 'customerSnapshot', 'addressSnapshot', 'deliverySnapshot', 'priceSnapshot'],
  order_items: [
    'tenantId',
    'storeId',
    'requestedQuantity',
    'fulfilledQuantity',
    'finalUnitPrice',
    'finalSubtotal',
    'status',
    'substitutionPolicy',
    'substitutedByItemId',
    'cutReason',
    'pickerNotes',
  ],
  order_events: ['tenantId', 'storeId', 'orderId', 'type', 'payload', 'actorType', 'actorId', 'createdAt'],
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

  await assertIndex('orders', 'orders_tenantId_storeId_status_idx')
  await assertIndex('order_items', 'order_items_tenantId_storeId_status_idx')
  await assertIndex('order_events', 'order_events_tenantId_storeId_orderId_createdAt_idx')
  await assertIndex('order_events', 'order_events_tenantId_storeId_type_createdAt_idx')

  await Promise.all([
    prisma.order.count(),
    prisma.orderItem.count(),
    prisma.orderEvent.count(),
  ])

  console.log('OMS foundation valid')
}

main()
  .catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
