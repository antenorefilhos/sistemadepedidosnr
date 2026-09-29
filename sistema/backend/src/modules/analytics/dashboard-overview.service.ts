import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../common/prisma.service'

// Painel inicial do admin (refeito em 29/09/2026 com o Jonathan). Tudo que a
// tela mostra sai daqui, ja calculado: antes o navegador baixava TODOS os
// pedidos da historia (duas vezes) e somava ate os cancelados na "Receita".
// Regras: pedido valido = nao cancelado/estornado; dia no fuso de Brasilia;
// cada numero vem com o do periodo anterior equivalente para comparar.

export type OverviewPeriod = 'day' | 'week' | 'month'

const BRT_OFFSET_MS = 3 * 60 * 60 * 1000 // Brasil sem horario de verao desde 2019
const DAY_MS = 24 * 60 * 60 * 1000
const INVALID = ['CANCELLED', 'REFUNDED']

// Etapas da operacao (pedidos em andamento), na ordem do fluxo.
const STAGES: Array<{ key: string; label: string; statuses: string[] }> = [
  { key: 'new', label: 'Novos', statuses: ['PENDING', 'PAYMENT_PENDING', 'CONFIRMED', 'PICKING_PENDING'] },
  { key: 'picking', label: 'Separando', statuses: ['PICKING', 'WAITING_CUSTOMER_SUBSTITUTION'] },
  { key: 'conference', label: 'Conferência', statuses: ['CONFERENCE_PENDING', 'PACKING'] },
  { key: 'checkout', label: 'No caixa', statuses: ['READY_FOR_CHECKOUT'] },
  { key: 'delivery', label: 'Entrega/retirada', statuses: ['READY_FOR_PICKUP', 'READY_FOR_DELIVERY', 'OUT_FOR_DELIVERY'] },
]
const ACTIVE = STAGES.flatMap((s) => s.statuses).concat('FAILED_SYNC')

// Minutos na mesma etapa ate virar alerta (updatedAt = ultima mudanca).
const STUCK_MINUTES: Record<string, { minutes: number; text: string }> = {
  PENDING: { minutes: 15, text: 'aguardando separação' },
  PAYMENT_PENDING: { minutes: 15, text: 'aguardando pagamento' },
  CONFIRMED: { minutes: 15, text: 'aguardando separação' },
  PICKING_PENDING: { minutes: 15, text: 'aguardando separação' },
  PICKING: { minutes: 45, text: 'em separação' },
  WAITING_CUSTOMER_SUBSTITUTION: { minutes: 10, text: 'cliente sem resposta sobre substituição' },
  CONFERENCE_PENDING: { minutes: 20, text: 'aguardando conferência' },
  PACKING: { minutes: 20, text: 'embalando' },
  READY_FOR_CHECKOUT: { minutes: 60, text: 'no caixa' },
  READY_FOR_PICKUP: { minutes: 120, text: 'pronto para retirada' },
  READY_FOR_DELIVERY: { minutes: 60, text: 'pronto, aguardando entregador' },
  OUT_FOR_DELIVERY: { minutes: 120, text: 'em rota de entrega' },
}

/** Meia-noite (Brasilia) do dia de `date`, em UTC. */
const startOfDayBrt = (date: Date) => {
  const local = new Date(date.getTime() - BRT_OFFSET_MS)
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) + BRT_OFFSET_MS)
}
const hourBrt = (date: Date) => new Date(date.getTime() - BRT_OFFSET_MS).getUTCHours()
const isoDayBrt = (date: Date) => new Date(date.getTime() - BRT_OFFSET_MS).toISOString().slice(0, 10)

export function periodRange(period: OverviewPeriod, now = new Date()) {
  const today = startOfDayBrt(now)
  if (period === 'day') {
    // Hoje ate agora x ontem ate a mesma hora (comparacao justa no meio do dia).
    return { from: today, to: now, prevFrom: new Date(today.getTime() - DAY_MS), prevTo: new Date(now.getTime() - DAY_MS) }
  }
  const days = period === 'week' ? 7 : 30
  const from = new Date(today.getTime() - (days - 1) * DAY_MS)
  return { from, to: now, prevFrom: new Date(from.getTime() - days * DAY_MS), prevTo: from }
}

const round2 = (n: number) => Math.round(n * 100) / 100
const parseMeta = (raw?: string | null): Record<string, unknown> => {
  try {
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

@Injectable()
export class DashboardOverviewService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview(period: OverviewPeriod, now = new Date()) {
    const range = periodRange(period, now)
    const [operation, results, site, products] = await Promise.all([
      this.operation(now),
      this.results(period, range),
      this.site(range),
      this.products(range),
    ])
    return { period, range, generatedAt: now.toISOString(), operation, results, site, products }
  }

  /** Agora: pedidos em andamento por etapa e o que esta parado. */
  private async operation(now: Date) {
    const orders = await this.prisma.order.findMany({
      where: { status: { in: ACTIVE } },
      select: {
        id: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        scheduledFor: true,
        erpDav: true,
        customer: { select: { name: true } },
      },
    })

    const stages = STAGES.map((stage) => ({
      key: stage.key,
      label: stage.label,
      count: orders.filter((o) => stage.statuses.includes(o.status)).length,
    }))

    const alerts: Array<{ orderId: string; code: string; customer: string; message: string; minutes: number }> = []
    for (const order of orders) {
      const code = order.id.slice(-8).toUpperCase()
      const customer = String(order.customer?.name || '').split(' ')[0]
      const age = Math.round((now.getTime() - order.createdAt.getTime()) / 60000)
      if (order.status === 'FAILED_SYNC') {
        alerts.push({ orderId: order.id, code, customer, message: 'não chegou ao ERP (falha de envio)', minutes: age })
        continue
      }
      // Agendado para mais de 1 h a frente: ainda nao e atraso.
      if (order.scheduledFor && order.scheduledFor.getTime() - now.getTime() > 60 * 60000) continue
      if (!order.erpDav && age >= 15) {
        alerts.push({ orderId: order.id, code, customer, message: 'sem DAV: não dá para puxar no caixa', minutes: age })
        continue
      }
      const rule = STUCK_MINUTES[order.status]
      const since = Math.round((now.getTime() - order.updatedAt.getTime()) / 60000)
      if (rule && since >= rule.minutes) {
        alerts.push({ orderId: order.id, code, customer, message: rule.text, minutes: since })
      }
    }
    alerts.sort((a, b) => b.minutes - a.minutes)

    return { active: orders.length, stages, alerts: alerts.slice(0, 8), alertCount: alerts.length }
  }

  /** Resultado do periodo x periodo anterior. */
  private async results(period: OverviewPeriod, range: ReturnType<typeof periodRange>) {
    const orders = await this.prisma.order.findMany({
      where: { createdAt: { gte: range.prevFrom, lte: range.to } },
      select: { id: true, status: true, total: true, createdAt: true, customerId: true },
    })
    const inCur = (d: Date) => d >= range.from && d <= range.to
    const inPrev = (d: Date) => d >= range.prevFrom && d < range.prevTo

    const summarize = (list: typeof orders) => {
      const valid = list.filter((o) => !INVALID.includes(o.status))
      const revenue = valid.reduce((sum, o) => sum + Number(o.total || 0), 0)
      return {
        revenue: round2(revenue),
        orders: valid.length,
        avgTicket: valid.length ? round2(revenue / valid.length) : 0,
        cancelRate: list.length ? round2(((list.length - valid.length) / list.length) * 100) : 0,
        customerIds: [...new Set(valid.map((o) => o.customerId))],
      }
    }
    const cur = summarize(orders.filter((o) => inCur(o.createdAt)))
    const prev = summarize(orders.filter((o) => inPrev(o.createdAt)))

    // Cliente novo = primeiro pedido valido da vida caiu no periodo.
    const firstOrders = cur.customerIds.length
      ? await this.prisma.order.groupBy({
          by: ['customerId'],
          where: { customerId: { in: cur.customerIds }, status: { notIn: INVALID } },
          _min: { createdAt: true },
        })
      : []
    const newCustomers = firstOrders.filter((f) => f._min.createdAt && f._min.createdAt >= range.from).length

    // Serie: por hora (hoje) ou por dia (7/30 dias).
    const validCur = orders.filter((o) => inCur(o.createdAt) && !INVALID.includes(o.status))
    let series: Array<{ label: string; revenue: number; orders: number }>
    if (period === 'day') {
      series = Array.from({ length: 24 }, (_, h) => ({ label: `${h}h`, revenue: 0, orders: 0 }))
      for (const o of validCur) {
        const slot = series[hourBrt(o.createdAt)]
        slot.revenue = round2(slot.revenue + Number(o.total || 0))
        slot.orders += 1
      }
    } else {
      const days = period === 'week' ? 7 : 30
      series = Array.from({ length: days }, (_, i) => {
        const iso = isoDayBrt(new Date(range.from.getTime() + i * DAY_MS + 12 * 60 * 60 * 1000))
        return { label: `${iso.slice(8, 10)}/${iso.slice(5, 7)}`, revenue: 0, orders: 0 }
      })
      for (const o of validCur) {
        const i = Math.floor((startOfDayBrt(o.createdAt).getTime() - range.from.getTime()) / DAY_MS)
        if (series[i]) {
          series[i].revenue = round2(series[i].revenue + Number(o.total || 0))
          series[i].orders += 1
        }
      }
    }

    // Pedidos por hora do dia no periodo (planejar equipe); em "hoje" e a propria serie.
    const byHour = Array.from({ length: 24 }, () => 0)
    for (const o of validCur) byHour[hourBrt(o.createdAt)] += 1

    const pick = ({ customerIds, ...rest }: typeof cur) => rest
    return {
      current: { ...pick(cur), newCustomers, returningCustomers: cur.customerIds.length - newCustomers },
      previous: pick(prev),
      series,
      ordersByHour: byHour,
    }
  }

  /** Site: funil por visitante (aparelho) e buscas que nao acharam nada. */
  private async site(range: ReturnType<typeof periodRange>) {
    const distinct = async (type?: string, from = range.from, to = range.to) =>
      (
        await this.prisma.analyticsEvent.findMany({
          where: { createdAt: { gte: from, lte: to }, deviceId: { not: null }, ...(type ? { type } : {}) },
          distinct: ['deviceId'],
          select: { deviceId: true },
        })
      ).length

    const [visitors, viewed, carted, checkout, ordered, prevVisitors, prevOrdered] = await Promise.all([
      distinct(),
      distinct('VIEW_PRODUCT'),
      distinct('ADD_TO_CART'),
      distinct('INITIATE_CHECKOUT'),
      distinct('ORDER_CREATED'),
      distinct(undefined, range.prevFrom, range.prevTo),
      distinct('ORDER_CREATED', range.prevFrom, range.prevTo),
    ])

    const searches = await this.prisma.analyticsEvent.findMany({
      where: { type: 'SEARCH', createdAt: { gte: range.from, lte: range.to } },
      select: { metadata: true },
      take: 5000,
    })
    const noResult = new Map<string, number>()
    for (const s of searches) {
      const meta = parseMeta(s.metadata)
      const term = String(meta.query || '').trim().toLowerCase()
      if (term && Number(meta.resultCount) === 0) noResult.set(term, (noResult.get(term) || 0) + 1)
    }

    const rate = (a: number, b: number) => (b ? round2((a / b) * 100) : 0)
    return {
      funnel: [
        { key: 'visitors', label: 'Visitantes', value: visitors },
        { key: 'viewed', label: 'Viram produto', value: viewed },
        { key: 'carted', label: 'Puseram no carrinho', value: carted },
        { key: 'checkout', label: 'Iniciaram checkout', value: checkout },
        { key: 'ordered', label: 'Fizeram pedido', value: ordered },
      ],
      conversion: { current: rate(ordered, visitors), previous: rate(prevOrdered, prevVisitors) },
      searches: searches.length,
      searchesWithoutResult: [...noResult.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([term, count]) => ({ term, count })),
    }
  }

  /** Produtos: o que vende, o que e visto e nao vende, o que falta na separacao. */
  private async products(range: ReturnType<typeof periodRange>) {
    const items = await this.prisma.orderItem.findMany({
      where: { order: { createdAt: { gte: range.from, lte: range.to }, status: { notIn: INVALID } } },
      select: { productId: true, quantity: true, subtotal: true, finalSubtotal: true, product: { select: { name: true } } },
    })
    const sold = new Map<string, { name: string; revenue: number; orders: number }>()
    for (const item of items) {
      const entry = sold.get(item.productId) || { name: item.product?.name || '', revenue: 0, orders: 0 }
      entry.revenue = round2(entry.revenue + Number(item.finalSubtotal ?? item.subtotal ?? 0))
      entry.orders += 1
      sold.set(item.productId, entry)
    }
    const topSold = [...sold.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 6)

    // Visto por muita gente e quase nunca posto no carrinho.
    const [views, carts] = await Promise.all(
      ['VIEW_PRODUCT', 'ADD_TO_CART'].map((type) =>
        this.prisma.analyticsEvent.findMany({
          where: { type, entity: 'PRODUCT', entityId: { not: null }, createdAt: { gte: range.from, lte: range.to } },
          select: { entityId: true, deviceId: true },
          take: 20000,
        }),
      ),
    )
    const uniq = (list: typeof views) => {
      const map = new Map<string, Set<string>>()
      for (const e of list) {
        if (!map.has(e.entityId!)) map.set(e.entityId!, new Set())
        map.get(e.entityId!)!.add(e.deviceId || '')
      }
      return map
    }
    const viewMap = uniq(views)
    const cartMap = uniq(carts)
    const candidates = [...viewMap.entries()]
      .map(([id, set]) => ({ id, views: set.size, carts: cartMap.get(id)?.size || 0 }))
      .filter((p) => p.views >= 5 && p.carts / p.views < 0.1)
      .sort((a, b) => b.views - a.views)
      .slice(0, 5)
    const names = candidates.length
      ? new Map(
          (await this.prisma.product.findMany({ where: { id: { in: candidates.map((c) => c.id) } }, select: { id: true, name: true } })).map(
            (p) => [p.id, p.name],
          ),
        )
      : new Map<string, string>()
    const viewedNotBought = candidates.map((c) => ({ name: names.get(c.id) || '', views: c.views, carts: c.carts }))

    // Faltou na separacao (ruptura real, nao estoque do ERP).
    const missing = await this.prisma.pickingTaskItem.findMany({
      where: { status: { in: ['MISSING', 'SUBSTITUTED'] }, task: { createdAt: { gte: range.from, lte: range.to } } },
      select: { productId: true, status: true },
    })
    const ruptureNames = new Map(
      (await this.prisma.product.findMany({ where: { id: { in: [...new Set(missing.map((m) => m.productId))] } }, select: { id: true, name: true } })).map(
        (p) => [p.id, p.name],
      ),
    )
    const ruptureMap = new Map<string, { name: string; missing: number; substituted: number }>()
    for (const m of missing) {
      const entry = ruptureMap.get(m.productId) || { name: ruptureNames.get(m.productId) || '', missing: 0, substituted: 0 }
      if (m.status === 'MISSING') entry.missing += 1
      else entry.substituted += 1
      ruptureMap.set(m.productId, entry)
    }
    const ruptures = [...ruptureMap.values()].sort((a, b) => b.missing + b.substituted - (a.missing + a.substituted)).slice(0, 5)

    return { topSold, viewedNotBought, ruptures }
  }
}
