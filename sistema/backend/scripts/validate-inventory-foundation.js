const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  const productsWithoutPosition = await prisma.product.count({
    where: {
      NOT: {
        id: {
          in: (await prisma.stockPosition.findMany({ select: { productId: true } })).map((item) => item.productId),
        },
      },
    },
  })

  const invalidPositions = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS count
    FROM stock_positions
    WHERE "available" <> ("onHand" - "reserved" - "safetyStock")
  `

  const negativeArtificialAvailability = await prisma.stockPosition.count({
    where: {
      onHand: { lte: 0 },
      available: { gt: 0 },
    },
  })

  const expiredActiveReservations = await prisma.stockReservation.count({
    where: {
      status: 'ACTIVE',
      expiresAt: { lte: new Date() },
    },
  })

  const formulaErrors = Number(invalidPositions[0]?.count || 0)
  const failures = []

  if (productsWithoutPosition > 0) {
    failures.push(`products_without_stock_position=${productsWithoutPosition}`)
  }
  if (formulaErrors > 0) {
    failures.push(`stock_positions_invalid_available_formula=${formulaErrors}`)
  }
  if (negativeArtificialAvailability > 0) {
    failures.push(`negative_or_zero_on_hand_with_positive_available=${negativeArtificialAvailability}`)
  }
  if (expiredActiveReservations > 0) {
    failures.push(`expired_active_reservations=${expiredActiveReservations}`)
  }

  if (failures.length > 0) {
    throw new Error(`Inventory foundation validation failed: ${failures.join(', ')}`)
  }

  console.log('Inventory foundation valid')
}

main()
  .catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
