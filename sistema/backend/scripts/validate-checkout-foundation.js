const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

const requiredColumns = {
  carts: ['tenantId', 'storeId', 'customerId', 'deviceId', 'status', 'createdAt', 'updatedAt'],
  cart_items: ['cartId', 'productId', 'quantity', 'notes', 'allowSubstitution', 'createdAt', 'updatedAt'],
  checkout_sessions: [
    'tenantId',
    'storeId',
    'cartId',
    'customerId',
    'idempotencyKey',
    'status',
    'priceSnapshot',
    'deliverySnapshot',
    'stockSnapshot',
    'paymentSnapshot',
    'orderId',
    'expiresAt',
  ],
  checkout_events: ['tenantId', 'storeId', 'cartId', 'checkoutSessionId', 'customerId', 'deviceId', 'type', 'metadata', 'createdAt'],
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

  await assertIndex('checkout_sessions', 'checkout_sessions_tenantId_storeId_idempotencyKey_key')
  await assertIndex('cart_items', 'cart_items_cartId_productId_key')
  await assertIndex('checkout_events', 'checkout_events_tenantId_storeId_type_createdAt_idx')

  await Promise.all([
    prisma.cart.count(),
    prisma.cartItem.count(),
    prisma.checkoutSession.count(),
    prisma.checkoutEvent.count(),
  ])

  console.log('Checkout foundation valid')
}

main()
  .catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
