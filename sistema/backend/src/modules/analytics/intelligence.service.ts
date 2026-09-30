import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../common/prisma.service'

/**
 * Inteligencia (29/09/2026): o que ajuda a decidir, calculado dos dados da
 * propria loja (eventos do site e pedidos), sem servico externo.
 *
 * Pessoas = aparelhos distintos (deviceId). Pedido = nao cancelado.
 */
const CANCELLED = ['CANCELLED', 'REFUNDED']

@Injectable()
export class IntelligenceService {
  constructor(private readonly prisma: PrismaService) {}

  private async funnel(from: Date, to: Date) {
    // Robo de busca (Google etc.) abre UMA pagina por "aparelho" e some: em
    // set/2026 eram 884 de 919 aparelhos. Visitante real = 2+ acoes ou logado.
    const [row] = await this.prisma.$queryRaw<Array<{ visitors: bigint; viewed: bigint; carted: bigint; checkout: bigint; bots: bigint }>>`
      WITH d AS (
        SELECT "deviceId", COUNT(*) AS n, bool_or("customerId" IS NOT NULL) AS logged,
          bool_or(type = 'VIEW_PRODUCT') AS v, bool_or(type = 'ADD_TO_CART') AS a, bool_or(type = 'INITIATE_CHECKOUT') AS k
        FROM analytics_events
        WHERE "createdAt" >= ${from} AND "createdAt" < ${to} AND "deviceId" IS NOT NULL
        GROUP BY 1
      )
      SELECT
        COUNT(*) FILTER (WHERE n >= 2 OR logged) AS visitors,
        COUNT(*) FILTER (WHERE (n >= 2 OR logged) AND v) AS viewed,
        COUNT(*) FILTER (WHERE a) AS carted,
        COUNT(*) FILTER (WHERE k) AS checkout,
        COUNT(*) FILTER (WHERE n = 1 AND NOT logged) AS bots
      FROM d`
    const orders = await this.prisma.order.count({ where: { createdAt: { gte: from, lt: to }, status: { notIn: CANCELLED } } })
    const buyers = await this.prisma.order.findMany({
      where: { createdAt: { gte: from, lt: to }, status: { notIn: CANCELLED } },
      select: { total: true },
    })
    const revenue = buyers.reduce((a, o) => a + Number(o.total || 0), 0)
    return {
      visitors: Number(row?.visitors || 0),
      viewed: Number(row?.viewed || 0),
      carted: Number(row?.carted || 0),
      checkout: Number(row?.checkout || 0),
      bots: Number(row?.bots || 0),
      orders,
      revenue,
      ticket: orders ? revenue / orders : 0,
    }
  }

  /**
   * Resultado de cada vitrine da pagina inicial (tela Layout do Site,
   * 30/09/2026). A loja grava `shelf` no ADD_TO_CART vindo de uma vitrine;
   * "virou pedido" = o mesmo aparelho fechou pedido com aquele produto em ate
   * 24h. Antes de 30/09 o clique nao dizia a vitrine: fica sem `shelf`.
   */
  async homeShelves(days: number) {
    const from = new Date(Date.now() - days * 86_400_000)
    const rows = await this.prisma.$queryRaw<Array<{ shelf: string | null; adds: number; orders: number; revenue: number }>>`
      WITH adds AS (
        SELECT metadata::jsonb->>'shelf' AS shelf, "deviceId", "entityId" AS product, "createdAt"
        FROM analytics_events
        WHERE type = 'ADD_TO_CART' AND "createdAt" >= ${from} AND metadata LIKE '{%' AND metadata::jsonb->>'source' = 'HOME'
      ),
      conv AS (
        SELECT DISTINCT a.shelf, o.id AS order_id, i."productId", i.subtotal
        FROM adds a
        JOIN orders o ON o."deviceId" = a."deviceId" AND o."createdAt" BETWEEN a."createdAt" AND a."createdAt" + interval '1 day'
          AND o.status NOT IN ('CANCELLED', 'REFUNDED')
        JOIN order_items i ON i."orderId" = o.id AND i."productId" = a.product
      ),
      por_adds AS (SELECT shelf, COUNT(*)::int AS adds FROM adds GROUP BY shelf),
      por_conv AS (SELECT shelf, COUNT(DISTINCT order_id)::int AS orders, COALESCE(SUM(subtotal), 0)::float AS revenue FROM conv GROUP BY shelf)
      SELECT a.shelf, a.adds, COALESCE(c.orders, 0)::int AS orders, COALESCE(c.revenue, 0)::float AS revenue
      FROM por_adds a LEFT JOIN por_conv c ON c.shelf IS NOT DISTINCT FROM a.shelf
      ORDER BY a.adds DESC`
    const [first] = await this.prisma.$queryRaw<Array<{ at: Date | null }>>`
      SELECT MIN("createdAt") AS at FROM analytics_events
      WHERE type = 'ADD_TO_CART' AND metadata LIKE '{%' AND metadata::jsonb ? 'shelf'`
    return {
      days,
      trackingSince: first?.at || null,
      shelves: rows.map((r) => ({ shelf: r.shelf, adds: Number(r.adds), orders: Number(r.orders), revenue: Math.round(Number(r.revenue) * 100) / 100 })),
    }
  }

  async overview(days = 30) {
    const d = Math.min(90, Math.max(7, days))
    const to = new Date()
    const from = new Date(to.getTime() - d * 86_400_000)
    const prevFrom = new Date(from.getTime() - d * 86_400_000)

    const [current, previous] = await Promise.all([this.funnel(from, to), this.funnel(prevFrom, from)])

    // Busca: o que procuram e o que nao acham (busca geral, sem filtro de categoria).
    const searches = await this.prisma.$queryRaw<Array<{ term: string; total: bigint; empty: bigint; last: Date }>>`
      SELECT lower(trim(COALESCE(metadata::jsonb->>'normalizedQuery', metadata::jsonb->>'query'))) AS term,
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE (metadata::jsonb->>'resultCount')::int = 0 AND COALESCE(metadata::jsonb->>'category', '') = '') AS empty,
        MAX("createdAt") AS last
      FROM analytics_events
      WHERE type = 'SEARCH' AND "createdAt" >= ${from} AND metadata LIKE '{%' AND COALESCE(metadata::jsonb->>'query', '') <> ''
      GROUP BY 1`
    const topSearches = searches
      .map((s) => ({ term: s.term, total: Number(s.total), empty: Number(s.empty), last: s.last }))
      .sort((a, b) => b.total - a.total)
    const noResult = topSearches.filter((s) => s.empty > 0).sort((a, b) => b.empty - a.empty)

    // Produtos: vistos x colocados no carrinho x vendidos.
    const products = await this.prisma.$queryRaw<Array<{ id: string; name: string; ean: string; views: bigint; adds: bigint; sold: bigint }>>`
      WITH real AS (
        SELECT "deviceId" FROM analytics_events WHERE "createdAt" >= ${from} AND "deviceId" IS NOT NULL
        GROUP BY 1 HAVING COUNT(*) >= 2 OR bool_or("customerId" IS NOT NULL)
      ), v AS (
        SELECT "entityId" AS id, COUNT(DISTINCT "deviceId") AS views FROM analytics_events
        WHERE type = 'VIEW_PRODUCT' AND "createdAt" >= ${from} AND "deviceId" IN (SELECT "deviceId" FROM real) GROUP BY 1
      ), a AS (
        SELECT "entityId" AS id, COUNT(DISTINCT "deviceId") AS adds FROM analytics_events
        WHERE type = 'ADD_TO_CART' AND "createdAt" >= ${from} GROUP BY 1
      ), s AS (
        SELECT i."productId" AS id, COUNT(DISTINCT o.id) AS sold FROM order_items i JOIN orders o ON o.id = i."orderId"
        WHERE o."createdAt" >= ${from} AND o.status NOT IN ('CANCELLED','REFUNDED') GROUP BY 1
      )
      SELECT p.id, COALESCE(p."titleMask", p.name) AS name, p.ean, COALESCE(v.views,0) AS views, COALESCE(a.adds,0) AS adds, COALESCE(s.sold,0) AS sold
      FROM products p LEFT JOIN v ON v.id = p.id LEFT JOIN a ON a.id = p.id LEFT JOIN s ON s.id = p.id
      WHERE v.id IS NOT NULL OR a.id IS NOT NULL OR s.id IS NOT NULL`
    const prod = products.map((p) => ({ id: p.id, name: p.name, ean: p.ean, views: Number(p.views), adds: Number(p.adds), sold: Number(p.sold) }))
    const topSold = [...prod].sort((a, b) => b.sold - a.sold || b.adds - a.adds).filter((p) => p.sold > 0).slice(0, 10)
    // Muita gente olha e pouca leva: preco, foto ou descricao a rever.
    const lookNoBuy = prod
      .filter((p) => p.views >= 5)
      .map((p) => ({ ...p, addRate: p.adds / p.views }))
      .filter((p) => p.addRate < 0.1)
      .sort((a, b) => b.views - a.views)
      .slice(0, 10)
    // Colocam no carrinho e nao compram.
    const abandoned = prod
      .filter((p) => p.adds >= 2 && p.sold < p.adds)
      .map((p) => ({ ...p, lost: p.adds - p.sold }))
      .sort((a, b) => b.lost - a.lost)
      .slice(0, 10)

    // Quando os pedidos chegam (dia da semana x hora, horario de Brasilia).
    const heat = await this.prisma.$queryRaw<Array<{ dow: number; hour: number; n: bigint }>>`
      SELECT EXTRACT(DOW FROM "createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo')::int AS dow,
        EXTRACT(HOUR FROM "createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo')::int AS hour,
        COUNT(*) AS n
      FROM orders WHERE "createdAt" >= ${from} AND status NOT IN ('CANCELLED','REFUNDED') GROUP BY 1, 2`

    // Clientes: primeira compra no periodo x quem ja tinha comprado antes.
    const [cust] = await this.prisma.$queryRaw<Array<{ buyers: bigint; first_time: bigint; returning: bigint }>>`
      WITH p AS (
        SELECT DISTINCT "customerId" FROM orders WHERE "createdAt" >= ${from} AND status NOT IN ('CANCELLED','REFUNDED') AND "customerId" IS NOT NULL
      )
      SELECT COUNT(*) AS buyers,
        COUNT(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o."customerId" = p."customerId" AND o."createdAt" < ${from} AND o.status NOT IN ('CANCELLED','REFUNDED'))) AS first_time,
        COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM orders o WHERE o."customerId" = p."customerId" AND o."createdAt" < ${from} AND o.status NOT IN ('CANCELLED','REFUNDED'))) AS returning
      FROM p`
    const [repeat] = await this.prisma.$queryRaw<Array<{ repeat: bigint }>>`
      SELECT COUNT(*) AS repeat FROM (
        SELECT "customerId" FROM orders WHERE "createdAt" >= ${from} AND status NOT IN ('CANCELLED','REFUNDED') AND "customerId" IS NOT NULL
        GROUP BY 1 HAVING COUNT(*) > 1
      ) r`

    return {
      days: d,
      funnel: { current, previous },
      search: { total: topSearches.reduce((a, s) => a + s.total, 0), top: topSearches.slice(0, 12), noResult: noResult.slice(0, 15) },
      products: { topSold, lookNoBuy, abandoned },
      heatmap: heat.map((h) => ({ dow: Number(h.dow), hour: Number(h.hour), n: Number(h.n) })),
      customers: {
        buyers: Number(cust?.buyers || 0),
        firstTime: Number(cust?.first_time || 0),
        returning: Number(cust?.returning || 0),
        boughtTwiceInPeriod: Number(repeat?.repeat || 0),
      },
    }
  }
}
