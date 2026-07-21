const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  const pricedProductIds = (
    await prisma.priceListItem.findMany({
      where: { price: { gt: 0 }, priceList: { status: 'ACTIVE' } },
      select: { productId: true },
      distinct: ['productId'],
    })
  ).map((item) => item.productId)

  const sellableProductsWithoutPrice = await prisma.product.count({
    where: {
      active: true,
      syncOption: { not: 'NUNCA' },
      OR: [{ promotionalPrice: { gt: 0 } }, { price: { gt: 0 } }],
      id: { notIn: pricedProductIds },
    },
  })

  const invalidPriceItems = await prisma.priceListItem.count({
    where: { price: { lte: 0 } },
  })

  const invalidPromotions = await prisma.promotion.count({
    where: {
      status: 'ACTIVE',
      endsAt: { lte: new Date() },
    },
  })

  const failures = []
  if (sellableProductsWithoutPrice > 0) failures.push(`sellable_products_without_price_list_item=${sellableProductsWithoutPrice}`)
  if (invalidPriceItems > 0) failures.push(`invalid_price_list_items=${invalidPriceItems}`)
  if (invalidPromotions > 0) failures.push(`active_expired_promotions=${invalidPromotions}`)

  if (failures.length > 0) {
    throw new Error(`Pricing foundation validation failed: ${failures.join(', ')}`)
  }

  console.log('Pricing foundation valid')
}

main()
  .catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
