import { PrismaClient, Prisma } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * Limpeza pontual dos produtos ja duplicados no banco (antes do fix na sync,
 * que agora agrupa por erpProductId). O ERP manda uma linha por EAN quando
 * um produto tem varios codigos de barra (embalagem antiga/nova, PLU
 * balanca) com o mesmo id_produto -- cada linha virava um Product separado.
 *
 * Agrupamento: por erpProductId quando presente; fallback por
 * nome+unidade+classificacao normalizados para produtos antigos sem
 * erpProductId gravado (sync anterior ao fix nao guardava esse campo).
 */

const DRY_RUN = process.argv.includes('--dry-run') || process.env.DRY_RUN === '1'

function normalize(value: string | null | undefined): string {
  return String(value || '').trim().toUpperCase()
}

function fallbackKey(p: { name: string; unit: string; classification01: string | null }): string {
  return `${normalize(p.name)}|${normalize(p.unit)}|${normalize(p.classification01)}`
}

async function moveUnique<T extends { productId: string }>(
  model: { updateMany: Function; delete: Function; findMany: Function },
  loserId: string,
  canonicalId: string,
  idField: string,
  conflictWhere: (row: any) => any,
) {
  const rows = await model.findMany({ where: { productId: loserId } })
  for (const row of rows) {
    try {
      await model.updateMany({ where: { [idField]: row[idField] }, data: { productId: canonicalId } })
    } catch {
      // conflito de unicidade (canonical ja tem linha equivalente): descarta a do perdedor
      await model.delete({ where: conflictWhere(row) }).catch(() => {})
    }
  }
}

async function main() {
  const products = await prisma.product.findMany({
    orderBy: { createdAt: 'asc' },
  })

  // Agrupa em duas passadas. A 1a agrupa por erpProductId (fonte confiavel).
  // A 2a pega quem ficou sem erpProductId (produto ainda nao resincronizado
  // apos o backfill, ou duplicata orfa que sobrou de um sync incompleto) e
  // tenta encaixar num grupo ja existente casando por qualquer EAN em comum
  // -- sem isso, uma duplicata que so tem erpProductId de um lado dos dois
  // registros nunca se funde, mesmo sendo claramente o mesmo produto.
  const groups = new Map<string, typeof products>()
  for (const p of products) {
    if (p.erpProductId == null) continue
    const key = `erp:${p.erpProductId}`
    const bucket = groups.get(key)
    if (bucket) bucket.push(p)
    else groups.set(key, [p])
  }

  const eanToKey = new Map<string, string>()
  for (const [key, bucket] of groups) {
    for (const p of bucket) {
      eanToKey.set(p.ean, key)
      for (const e of p.secondaryEans) eanToKey.set(e, key)
    }
  }

  for (const p of products) {
    if (p.erpProductId != null) continue
    const matchedKey = eanToKey.get(p.ean) ?? p.secondaryEans.map((e) => eanToKey.get(e)).find(Boolean)
    const key = matchedKey ?? `name:${fallbackKey(p)}`
    const bucket = groups.get(key)
    if (bucket) bucket.push(p)
    else groups.set(key, [p])
  }

  const duplicateGroups = Array.from(groups.values()).filter((g) => g.length > 1)
  console.log(`${duplicateGroups.length} grupo(s) de produto duplicado encontrado(s) (de ${products.length} produtos).`)

  if (DRY_RUN) {
    for (const group of duplicateGroups) {
      console.log(`  - ${group.map((p) => `${p.ean} (${p.name})`).join(' | ')}`)
    }
    console.log('\n--dry-run: nada foi alterado.')
    return
  }

  let merged = 0
  for (const group of duplicateGroups) {
    const productIds = group.map((p) => p.id)
    const [orderCounts, masters] = await Promise.all([
      prisma.orderItem.groupBy({ by: ['productId'], where: { productId: { in: productIds } }, _count: true }),
      prisma.productMaster.findMany({
        where: { legacyProductId: { in: productIds } },
        include: { _count: { select: { media: true } } },
      }),
    ])
    const orderCountByProduct = new Map(orderCounts.map((o) => [o.productId, o._count]))
    const masterByProduct = new Map(masters.map((m) => [m.legacyProductId as string, m]))

    const scored = group
      .map((p) => ({
        product: p,
        score: (orderCountByProduct.get(p.id) || 0) * 1000 + (masterByProduct.get(p.id)?._count.media || 0),
      }))
      .sort((a, b) => b.score - a.score)

    const canonical = scored[0].product
    const losers = scored.slice(1).map((s) => s.product)

    const allEans = new Set<string>()
    let erpProductId = canonical.erpProductId
    for (const p of group) {
      allEans.add(p.ean)
      for (const e of p.secondaryEans) allEans.add(e)
      if (erpProductId == null && p.erpProductId != null) erpProductId = p.erpProductId
    }
    allEans.delete(canonical.ean)

    for (const loser of losers) {
      await prisma.orderItem.updateMany({ where: { productId: loser.id }, data: { productId: canonical.id } })
      await prisma.promoBanner.updateMany({ where: { highlightedProductId: loser.id }, data: { highlightedProductId: canonical.id } })

      await moveUnique(prisma.categoryProductCuration as any, loser.id, canonical.id, 'id', (row) => ({ id: row.id }))
      await moveUnique(prisma.recipeProduct as any, loser.id, canonical.id, 'id', (row) => ({ id: row.id }))
      await moveUnique(prisma.cartItem as any, loser.id, canonical.id, 'id', (row) => ({ id: row.id }))
      await moveUnique(prisma.shoppingListItem as any, loser.id, canonical.id, 'id', (row) => ({ id: row.id }))
      await moveUnique(prisma.stockPosition as any, loser.id, canonical.id, 'id', (row) => ({ id: row.id }))
      await moveUnique(prisma.priceListItem as any, loser.id, canonical.id, 'id', (row) => ({ id: row.id }))
      await moveUnique(prisma.channelProduct as any, loser.id, canonical.id, 'id', (row) => ({ id: row.id }))

      await prisma.stockLedger.updateMany({ where: { productId: loser.id }, data: { productId: canonical.id } })
      await prisma.stockReservation.updateMany({ where: { productId: loser.id }, data: { productId: canonical.id } })
      await prisma.priceAuditLog.updateMany({ where: { productId: loser.id }, data: { productId: canonical.id } })
      await prisma.notification.updateMany({ where: { productId: loser.id }, data: { productId: canonical.id } })
      await prisma.recommendationEvent.updateMany({ where: { productId: loser.id }, data: { productId: canonical.id } })
      await prisma.stockPolicy.updateMany({ where: { productId: loser.id }, data: { productId: canonical.id } }).catch(() => {})

      const loserMaster = masterByProduct.get(loser.id)
      const canonicalMaster = masterByProduct.get(canonical.id)
      if (loserMaster) {
        if (canonicalMaster && loserMaster._count.media > 0 && canonicalMaster._count.media === 0) {
          await prisma.productMedia.updateMany({ where: { productId: loserMaster.id }, data: { productId: canonicalMaster.id } })
        }
        await prisma.productMaster.delete({ where: { id: loserMaster.id } }).catch(() => {})
      }

      await prisma.product.delete({ where: { id: loser.id } })
    }

    await prisma.product.update({
      where: { id: canonical.id },
      data: { erpProductId, secondaryEans: Array.from(allEans) },
    })

    merged += 1
    console.log(`  [${merged}/${duplicateGroups.length}] ${canonical.ean} <- fundido com ${losers.map((l) => l.ean).join(', ')}`)
  }

  console.log(`\n${merged} grupo(s) fundido(s). Rode a sync do ERP em seguida para reindexar no Meilisearch.`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
