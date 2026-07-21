const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

const requiredColumns = {
  picking_batches: ['tenantId', 'storeId', 'status', 'assignedToId', 'startedAt', 'completedAt', 'createdAt', 'updatedAt'],
  picking_tasks: ['tenantId', 'storeId', 'batchId', 'orderId', 'status', 'priority', 'slaDueAt', 'assignedToId', 'startedAt', 'completedAt', 'createdAt', 'updatedAt'],
  picking_task_items: ['tenantId', 'storeId', 'taskId', 'orderItemId', 'productId', 'requestedQuantity', 'pickedQuantity', 'finalWeight', 'status', 'barcode', 'notes', 'createdAt', 'updatedAt'],
  picker_performance_snapshots: ['tenantId', 'storeId', 'pickerId', 'periodStart', 'periodEnd', 'tasksCompleted', 'itemsPicked', 'itemsMissing', 'substitutions', 'pickingSeconds', 'itemsPerMinute', 'createdAt'],
  packing_checklists: ['tenantId', 'storeId', 'orderId', 'taskId', 'status', 'items', 'checkedById', 'notes', 'createdAt', 'updatedAt'],
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

  await assertIndex('picking_batches', 'picking_batches_tenantId_storeId_status_idx')
  await assertIndex('picking_tasks', 'picking_tasks_tenantId_storeId_orderId_key')
  await assertIndex('picking_tasks', 'picking_tasks_tenantId_storeId_status_priority_idx')
  await assertIndex('picking_task_items', 'picking_task_items_tenantId_storeId_status_idx')
  await assertIndex('picker_performance_snapshots', 'picker_performance_snapshots_tenantId_storeId_pickerId_periodSt')
  await assertIndex('packing_checklists', 'packing_checklists_tenantId_storeId_orderId_idx')

  await Promise.all([
    prisma.pickingBatch.count(),
    prisma.pickingTask.count(),
    prisma.pickingTaskItem.count(),
    prisma.pickerPerformanceSnapshot.count(),
    prisma.packingChecklist.count(),
  ])

  console.log('Picking foundation valid')
}

main()
  .catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
