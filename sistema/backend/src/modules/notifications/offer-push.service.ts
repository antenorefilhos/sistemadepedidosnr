import { readdirSync } from 'fs'
import { join } from 'path'
import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { PrismaService } from '../../common/prisma.service'
import { isProductSellable } from '../../common/product-availability'
import { notOfferedCategoryCodes } from '../../common/not-offered-categories'
import { isWithinDeliveryHours, parseHoursConfig } from '../../common/delivery-hours'
import { NotificationsService } from './notifications.service'

/**
 * Avisos automaticos de oferta (29/09/2026) -- substitui o ciclo que pedia a um
 * modelo de IA externo (NVIDIA) para decidir e escrever o aviso: parou sozinho
 * quando o modelo foi descontinuado. Aqui e um algoritmo proprio, alimentado
 * pelos dados da loja:
 *
 * 1. Candidatos: produto a venda, com foto, em promocao vigente com desconto
 *    minimo, de departamento que o site oferece.
 * 2. Nota da oferta: desconto x procura (vendas e visitas de 30 dias) x peso do
 *    departamento, que e APRENDIDO com o resultado dos avisos anteriores
 *    (abriu / nao abriu), com suavizacao para nao oscilar com pouco dado.
 * 3. Para cada cliente com aviso ligado: interesse pelo que ele comprou ou olhou
 *    (produto e departamento). Cada um recebe a oferta de maior nota para ele.
 * 4. Limites: 1 por dia, maxPerWeek por semana, nunca o mesmo produto em 14 dias,
 *    so dentro do horario de entrega da loja.
 */

const DAY = 86_400_000
const EMOJI: Array<[RegExp, string]> = [
  [/ACOUGUE/, '🥩'],
  [/HORTIFRUTI/, '🥬'],
  [/PADARIA/, '🥖'],
  [/QUEIJOS/, '🧀'],
  [/ADEGA/, '🍷'],
  [/CERVEJAS/, '🍺'],
  [/DESTILADOS/, '🥃'],
  [/SUCOS/, '🥤'],
  [/DOCES/, '🍫'],
  [/CONGELADOS/, '🧊'],
  [/LIMPEZA/, '🧽'],
  [/HIGIENE/, '🧴'],
  [/PET/, '🐾'],
  [/BEBE/, '🍼'],
  [/SAUDAVEL/, '🥗'],
  [/MERCEARIA/, '🛒'],
]
const emojiFor = (category: string) => EMOJI.find(([re]) => re.test(category))?.[1] || '🔥'
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export type OfferPick = {
  customerId: string
  customerName: string
  productId: string
  productName: string
  category: string
  discount: number
  score: number
  reason: string
  title: string
  body: string
}

@Injectable()
export class OfferPushService {
  private readonly logger = new Logger(OfferPushService.name)
  private running = false

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async getSettings() {
    return this.prisma.autoOfferSettings.upsert({ where: { id: 'singleton' }, update: {}, create: { id: 'singleton' } })
  }

  async updateSettings(dto: { enabled?: boolean; minDiscount?: number; maxPerWeek?: number; sendHours?: string }) {
    const data: Record<string, unknown> = {}
    if (dto.enabled !== undefined) data.enabled = Boolean(dto.enabled)
    if (dto.minDiscount !== undefined) data.minDiscount = Math.min(80, Math.max(5, Math.round(Number(dto.minDiscount))))
    if (dto.maxPerWeek !== undefined) data.maxPerWeek = Math.min(7, Math.max(1, Math.round(Number(dto.maxPerWeek))))
    if (dto.sendHours !== undefined) {
      const hours = String(dto.sendHours).split(',').map((h) => Number(h.trim())).filter((h) => Number.isInteger(h) && h >= 7 && h <= 21)
      data.sendHours = [...new Set(hours)].sort((a, b) => a - b).join(',') || '11,17'
    }
    return this.prisma.autoOfferSettings.upsert({ where: { id: 'singleton' }, update: data, create: { id: 'singleton', ...data } })
  }

  /**
   * Peso por departamento aprendido com os avisos AUTO dos ultimos 60 dias:
   * taxa de abertura do departamento / taxa geral, suavizada (media bayesiana,
   * 10 avisos "imaginarios" na media geral) e limitada entre 0,5 e 2.
   */
  async learnWeights() {
    const rows = await this.prisma.$queryRaw<Array<{ category: string; sent: bigint; opened: bigint }>>`
      SELECT p.category, COUNT(*) AS sent, COUNT(*) FILTER (WHERE n."clickedAt" IS NOT NULL OR n.read) AS opened
      FROM notifications n JOIN products p ON p.id = n."productId"
      WHERE n.source = 'AUTO' AND n."createdAt" > now() - interval '60 days'
      GROUP BY p.category`
    const sent = rows.reduce((a, r) => a + Number(r.sent), 0)
    const opened = rows.reduce((a, r) => a + Number(r.opened), 0)
    const globalRate = sent ? (opened + 1) / (sent + 10) : 0.1
    const weights: Record<string, { weight: number; sent: number; opened: number }> = {}
    for (const r of rows) {
      const rate = (Number(r.opened) + globalRate * 10) / (Number(r.sent) + 10)
      weights[r.category] = { weight: Math.min(2, Math.max(0.5, rate / globalRate)), sent: Number(r.sent), opened: Number(r.opened) }
    }
    return { weights, sent, opened, globalRate }
  }

  /** Monta o plano (quem recebe o que). dryRun nao envia nada. */
  async plan(now = new Date()) {
    const settings = await this.getSettings()
    const minDiscount = settings.minDiscount / 100
    const notOffered = await notOfferedCategoryCodes(this.prisma)

    let files: string[] = []
    try {
      files = readdirSync(join(process.cwd(), 'uploads', 'products'))
    } catch {
      files = []
    }
    const withPhoto = new Set(files.filter((f) => /\.(webp|jpe?g|png)$/i.test(f)).map((f) => f.replace(/\.[^.]+$/, '')))
    const mapped = new Set((await this.prisma.productCategoryMapping.findMany({ select: { ean: true } })).map((m) => m.ean))

    const raw = await this.prisma.product.findMany({
      where: { active: true, promotionalPrice: { gt: 0 } },
      select: { id: true, ean: true, name: true, titleMask: true, category: true, price: true, promotionalPrice: true, promotionalPriceValidUntil: true, active: true, syncOption: true, stock: true, isFractional: true, unit: true },
    })
    const candidates = raw.filter((p) => {
      const promo = p.promotionalPrice!
      if (promo >= p.price) return false
      if (p.promotionalPriceValidUntil && p.promotionalPriceValidUntil.getTime() < now.getTime()) return false
      if (1 - promo / p.price < minDiscount) return false
      return isProductSellable(p) && mapped.has(p.ean) && withPhoto.has(p.ean) && !notOffered.has(String(p.category || ''))
    })

    const ids = candidates.map((c) => c.id)
    const [sales, views] = await Promise.all([
      this.prisma.$queryRaw<Array<{ productId: string; n: bigint }>>`
        SELECT i."productId", COUNT(*) AS n FROM order_items i JOIN orders o ON o.id = i."orderId"
        WHERE o."createdAt" > now() - interval '30 days' AND o.status NOT IN ('CANCELLED','REFUNDED') AND i."productId" = ANY(${ids})
        GROUP BY 1`,
      this.prisma.$queryRaw<Array<{ productId: string; n: bigint }>>`
        SELECT "entityId" AS "productId", COUNT(*) AS n FROM analytics_events
        WHERE type = 'VIEW_PRODUCT' AND "createdAt" > now() - interval '30 days' AND "entityId" = ANY(${ids})
        GROUP BY 1`,
    ])
    const salesBy = new Map(sales.map((r) => [r.productId, Number(r.n)]))
    const viewsBy = new Map(views.map((r) => [r.productId, Number(r.n)]))
    const { weights } = await this.learnWeights()

    const scored = candidates
      .map((p) => {
        const discount = 1 - p.promotionalPrice! / p.price
        const demand = Math.log1p((salesBy.get(p.id) || 0) * 3 + (viewsBy.get(p.id) || 0))
        const weight = weights[p.category]?.weight ?? 1
        return { p, discount, base: discount * 100 * (1 + demand) * weight }
      })
      .sort((a, b) => b.base - a.base)

    // Clientes com aviso ligado e o que cada um comprou/olhou.
    const subs = await this.prisma.pushSubscription.findMany({ where: { customerId: { not: null } }, select: { customerId: true } })
    const customerIds = [...new Set(subs.map((s) => s.customerId!))]
    if (!customerIds.length || !scored.length) return { settings, candidates: scored.length, customers: customerIds.length, picks: [] as OfferPick[] }

    const [customers, bought, viewed, recent] = await Promise.all([
      this.prisma.customer.findMany({ where: { id: { in: customerIds } }, select: { id: true, name: true } }),
      this.prisma.$queryRaw<Array<{ customerId: string; productId: string; category: string }>>`
        SELECT DISTINCT o."customerId", i."productId", p.category FROM orders o JOIN order_items i ON i."orderId" = o.id JOIN products p ON p.id = i."productId"
        WHERE o."customerId" = ANY(${customerIds}) AND o."createdAt" > now() - interval '90 days' AND o.status NOT IN ('CANCELLED','REFUNDED')`,
      this.prisma.$queryRaw<Array<{ customerId: string; productId: string; category: string }>>`
        SELECT DISTINCT e."customerId", e."entityId" AS "productId", p.category FROM analytics_events e JOIN products p ON p.id = e."entityId"
        WHERE e.type = 'VIEW_PRODUCT' AND e."customerId" = ANY(${customerIds}) AND e."createdAt" > now() - interval '30 days'`,
      this.prisma.notification.findMany({
        // Limites contam QUALQUER aviso de marketing (automatico, manual ou
        // agendado): quem recebeu uma campanha hoje nao leva oferta automatica.
        where: { customerId: { in: customerIds }, source: { in: ['AUTO', 'MANUAL', 'SCHEDULED'] }, type: { not: 'ORDER_UPDATE' }, createdAt: { gte: new Date(now.getTime() - 14 * DAY) } },
        select: { customerId: true, productId: true, createdAt: true },
      }),
    ])
    const nameBy = new Map(customers.map((c) => [c.id, c.name]))
    const index = (rows: Array<{ customerId: string; productId: string; category: string }>) => {
      const m = new Map<string, { products: Set<string>; categories: Set<string> }>()
      for (const r of rows) {
        const e = m.get(r.customerId) || { products: new Set(), categories: new Set() }
        e.products.add(r.productId)
        e.categories.add(r.category)
        m.set(r.customerId, e)
      }
      return m
    }
    const boughtBy = index(bought)
    const viewedBy = index(viewed)

    const picks: OfferPick[] = []
    for (const customerId of customerIds) {
      const mine = recent.filter((n) => n.customerId === customerId)
      if (mine.some((n) => now.getTime() - n.createdAt.getTime() < 20 * 3600_000)) continue
      if (mine.filter((n) => now.getTime() - n.createdAt.getTime() < 7 * DAY).length >= settings.maxPerWeek) continue
      const sentProducts = new Set(mine.map((n) => n.productId).filter(Boolean))
      const b = boughtBy.get(customerId)
      const v = viewedBy.get(customerId)

      let best: { s: (typeof scored)[number]; score: number; reason: string } | null = null
      for (const s of scored.slice(0, 200)) {
        if (sentProducts.has(s.p.id)) continue
        let affinity = 0
        let reason = 'melhor oferta do dia'
        if (b?.products.has(s.p.id)) (affinity = 3), (reason = 'já comprou este produto')
        else if (v?.products.has(s.p.id)) (affinity = 2), (reason = 'olhou este produto')
        else if (b?.categories.has(s.p.category)) (affinity = 1.2), (reason = 'compra neste departamento')
        else if (v?.categories.has(s.p.category)) (affinity = 0.8), (reason = 'olhou este departamento')
        const score = s.base * (1 + affinity)
        if (!best || score > best.score) best = { s, score, reason }
      }
      if (!best) continue
      const p = best.s.p
      const name = p.titleMask || p.name
      const pct = Math.round(best.s.discount * 100)
      const unit = p.isFractional ? '/kg' : ''
      const until = p.promotionalPriceValidUntil ? ` Até ${p.promotionalPriceValidUntil.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' })}.` : ''
      picks.push({
        customerId,
        customerName: nameBy.get(customerId) || '',
        productId: p.id,
        productName: name,
        category: p.category,
        discount: pct,
        score: Math.round(best.score),
        reason: best.reason,
        title: `${emojiFor(p.category)} ${name} com ${pct}% OFF`,
        body: `De ${brl(p.price)} por ${brl(p.promotionalPrice!)}${unit}.${until} Peça pelo site e receba em casa.`,
      })
    }
    return { settings, candidates: scored.length, customers: customerIds.length, picks }
  }

  /** Envia o plano. Um lote por produto (clientes que receberam a mesma oferta). */
  async run(opts: { force?: boolean } = {}) {
    if (this.running) return { skipped: true, reason: 'já está rodando' }
    this.running = true
    try {
      const settings = await this.getSettings()
      if (!settings.enabled && !opts.force) return { skipped: true, reason: 'desligado' }
      const brand = await this.prisma.brandConfig.findFirst({ select: { businessHours: true, specialDates: true } })
      const hours = parseHoursConfig(brand?.businessHours, brand?.specialDates)
      if (hours && !isWithinDeliveryHours(hours, new Date())) return { skipped: true, reason: 'loja fora do horário de entrega' }

      const { picks, candidates, customers } = await this.plan()
      const byProduct = new Map<string, OfferPick[]>()
      for (const pick of picks) byProduct.set(pick.productId, [...(byProduct.get(pick.productId) || []), pick])
      for (const [productId, group] of byProduct) {
        const product = await this.prisma.product.findUnique({ where: { id: productId }, select: { ean: true } })
        await this.notifications.broadcastToCustomers(group.map((g) => g.customerId), {
          type: 'PROMO',
          title: group[0].title,
          body: group[0].body,
          imageUrl: product ? `/uploads/products/${product.ean}.webp` : undefined,
          productId,
          source: 'AUTO',
        })
      }
      const summary = { at: new Date().toISOString(), candidates, customers, sent: picks.length, products: byProduct.size }
      await this.prisma.autoOfferSettings.update({ where: { id: 'singleton' }, data: { lastRunAt: new Date(), lastRunSummary: summary } })
      this.logger.log(`avisos_de_oferta ${JSON.stringify(summary)}`)
      return summary
    } finally {
      this.running = false
    }
  }

  // De hora em hora; so envia nos horarios configurados (padrao 11h e 17h).
  @Cron('0 * * * *', { name: 'auto-offer-push', timeZone: 'America/Sao_Paulo' })
  async tick() {
    const settings = await this.getSettings()
    const hour = Number(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo', hour: 'numeric', hour12: false }))
    if (!settings.enabled || !settings.sendHours.split(',').map(Number).includes(hour)) return
    await this.run().catch((e) => this.logger.error(`avisos_de_oferta falhou: ${e instanceof Error ? e.message : e}`))
  }

  /** Resultado dos ultimos 30 dias (AUTO x manuais) e pesos aprendidos. */
  async overview() {
    const settings = await this.getSettings()
    const stats = await this.prisma.$queryRaw<Array<{ source: string; sent: bigint; opened: bigint; orders: bigint; revenue: number | null }>>`
      WITH n AS (SELECT *, COALESCE(source, 'MANUAL') AS src FROM notifications WHERE type <> 'ORDER_UPDATE' AND "createdAt" > now() - interval '30 days'),
      o AS (
        SELECT DISTINCT n.src, ord.id, ord.total FROM n
        JOIN orders ord ON ord."customerId" = n."customerId" AND ord."createdAt" > n."createdAt" AND ord."createdAt" <= n."createdAt" + interval '48 hours'
          AND ord.status NOT IN ('CANCELLED','REFUNDED')
      ),
      s AS (SELECT src, COUNT(*) AS sent, COUNT(*) FILTER (WHERE "clickedAt" IS NOT NULL OR read) AS opened FROM n GROUP BY src),
      r AS (SELECT src, COUNT(*) AS orders, COALESCE(SUM(total), 0)::float AS revenue FROM o GROUP BY src)
      SELECT s.src AS source, s.sent, s.opened, COALESCE(r.orders, 0) AS orders, COALESCE(r.revenue, 0) AS revenue
      FROM s LEFT JOIN r ON r.src = s.src`
    const learned = await this.learnWeights()
    const subscribers = await this.prisma.pushSubscription.findMany({ where: { customerId: { not: null } }, select: { customerId: true }, distinct: ['customerId'] })
    return {
      settings,
      subscribers: subscribers.length,
      stats: stats.map((s) => ({ source: s.source, sent: Number(s.sent), opened: Number(s.opened), orders: Number(s.orders), revenue: Number(s.revenue || 0) })),
      departments: Object.entries(learned.weights)
        .map(([category, w]) => ({ category, ...w }))
        .sort((a, b) => b.weight - a.weight),
    }
  }
}
