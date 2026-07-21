const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

const requiredColumns = {
  orders: ['deliveryAreaId', 'fulfillmentSlotId', 'fulfillmentSlotItemCount'],
  checkout_sessions: ['fulfillmentSlotId', 'fulfillmentSlotReserved', 'fulfillmentSlotItemCount'],
  delivery_areas: ['tenantId', 'storeId', 'name', 'type', 'rule', 'fee', 'minimumOrder', 'freeAbove', 'priority', 'status', 'createdAt', 'updatedAt'],
  fulfillment_slots: ['tenantId', 'storeId', 'type', 'startsAt', 'endsAt', 'capacityOrders', 'capacityItems', 'reservedOrders', 'reservedItems', 'cutoffMinutes', 'status', 'createdAt', 'updatedAt'],
  drivers: ['tenantId', 'storeId', 'name', 'phone', 'status', 'createdAt', 'updatedAt'],
  delivery_routes: ['tenantId', 'storeId', 'driverId', 'status', 'startsAt', 'completedAt', 'createdAt', 'updatedAt'],
  delivery_stops: ['tenantId', 'storeId', 'routeId', 'orderId', 'sequence', 'status', 'eta', 'deliveredAt', 'createdAt', 'updatedAt'],
  fulfillment_events: ['tenantId', 'storeId', 'orderId', 'routeId', 'stopId', 'type', 'payload', 'actorType', 'actorId', 'createdAt'],
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

  await assertIndex('orders', 'orders_tenantId_storeId_fulfillmentSlotId_idx')
  await assertIndex('checkout_sessions', 'checkout_sessions_tenantId_storeId_fulfillmentSlotId_idx')
  await assertIndex('delivery_areas', 'delivery_areas_tenantId_storeId_status_priority_idx')
  await assertIndex('fulfillment_slots', 'fulfillment_slots_tenantId_storeId_type_startsAt_idx')
  await assertIndex('drivers', 'drivers_tenantId_storeId_status_idx')
  await assertIndex('delivery_routes', 'delivery_routes_tenantId_storeId_status_createdAt_idx')
  await assertIndex('delivery_stops', 'delivery_stops_routeId_orderId_key')
  await assertIndex('fulfillment_events', 'fulfillment_events_tenantId_storeId_orderId_createdAt_idx')

  await Promise.all([
    prisma.deliveryArea.count(),
    prisma.fulfillmentSlot.count(),
    prisma.driver.count(),
    prisma.deliveryRoute.count(),
    prisma.deliveryStop.count(),
    prisma.fulfillmentEvent.count(),
  ])

  console.log('Fulfillment foundation valid')
}

main()
  .catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
