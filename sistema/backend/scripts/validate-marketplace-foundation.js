const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

const requiredColumns = {
  sales_channels: ['tenantId', 'storeId', 'type', 'provider', 'name', 'status', 'config'],
  channel_products: ['tenantId', 'storeId', 'channelId', 'productId', 'externalId', 'externalSku', 'status', 'priceMode', 'stockMode', 'metadata'],
  marketplace_orders: ['tenantId', 'storeId', 'channelId', 'externalId', 'orderId', 'status', 'mappedStatus', 'payload', 'failureReason', 'receivedAt', 'processedAt'],
  channel_price_policies: ['tenantId', 'storeId', 'channelId', 'mode', 'markupPercent', 'minMargin', 'roundingMode', 'status'],
  channel_stock_policies: ['tenantId', 'storeId', 'channelId', 'bufferQuantity', 'stockMode', 'allowOversell', 'status'],
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

  await assertIndex('sales_channels', 'sales_channels_tenantId_storeId_type_provider_key')
  await assertIndex('channel_products', 'channel_products_channelId_productId_key')
  await assertIndex('marketplace_orders', 'marketplace_orders_channelId_externalId_key')
  await assertIndex('channel_price_policies', 'channel_price_policies_channelId_mode_key')
  await assertIndex('channel_stock_policies', 'channel_stock_policies_channelId_stockMode_key')

  await Promise.all([
    prisma.salesChannel.count(),
    prisma.channelProduct.count(),
    prisma.marketplaceOrder.count(),
    prisma.channelPricePolicy.count(),
    prisma.channelStockPolicy.count(),
  ])

  console.log('Marketplace multichannel foundation valid')
}

main()
  .catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
