import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { PrismaService } from '../../common/prisma.service'
import { personalize, shortProductName } from '../../common/personalize'

/**
 * Lembrete de carrinho esquecido (refeito em 02/10/2026).
 *
 * Antes: olhava o carrinho que o CHECKOUT cria no servidor -- um por tentativa
 * de checkout. Em producao, 39 de 43 lembretes foram repetidos (varios na mesma
 * hora para a mesma pessoa), 7 foram para quem ja tinha comprado, e quem enchia
 * o carrinho sem chegar ao checkout nunca era lembrado.
 *
 * Agora: o site manda o carrinho de quem esta logado (cart_snapshots, um por
 * cliente). Com o carrinho parado, o lembrete entra na FILA DE ENVIOS para sair
 * `cartDelayMinutes` depois da ultima mudanca, com a loja aberta. Mexeu no
 * carrinho, esvaziou ou comprou: o lembrete daquela versao sai da fila.
 * Texto, espera, valor minimo, foto e intervalo entre lembretes sao da tela.
 */
const QUIET_MS = 10 * 60_000 // cliente parou de mexer
const PENDING = ['SCHEDULED', 'PENDING_APPROVAL']
const DONE_ORDER = { notIn: ['CANCELLED', 'REFUNDED'] }

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }).replace(/\u00a0/g, ' ')

/** Monta o texto do lembrete: {nome}, {produto}, {itens} e {total}. */
export function renderCartTemplate(template: string, ctx: { name?: string | null; product: string; itemCount: number; subtotal: number }) {
  const others = ctx.itemCount - 1
  const itens = others > 0 ? `${ctx.product} e mais ${others} ${others === 1 ? 'item' : 'itens'}` : ctx.product
  const filled = String(template || '')
    .replace(/\{\s*produto\s*\}/gi, ctx.product)
    .replace(/\{\s*itens\s*\}/gi, itens)
    .replace(/\{\s*total\s*\}/gi, brl(ctx.subtotal))
  return personalize(filled, ctx.name).replace(/\s{2,}/g, ' ').trim()
}

type SnapshotItem = { productId: string; quantity: number }

@Injectable()
export class CartReminderService {
  private readonly logger = new Logger(CartReminderService.name)
  private running = false

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Carrinho do site do cliente logado. So muda `updatedAt` quando o conteudo
   * muda; carrinho vazio apaga. Preco vem do banco (nunca do navegador).
   */
  async saveSnapshot(customerId: string, raw: unknown) {
    const list = Array.isArray(raw) ? raw.slice(0, 200) : []
    const wanted = new Map<string, number>()
    for (const r of list as Array<Partial<SnapshotItem>>) {
      const id = typeof r?.productId === 'string' ? r.productId.slice(0, 64) : ''
      const qty = Number(r?.quantity)
      if (id && Number.isFinite(qty) && qty > 0 && qty < 10_000) wanted.set(id, (wanted.get(id) || 0) + qty)
    }
    if (!wanted.size) {
      await this.prisma.cartSnapshot.deleteMany({ where: { customerId } })
      return { items: 0 }
    }
    const products = await this.prisma.product.findMany({ where: { id: { in: [...wanted.keys()] } }, select: { id: true, price: true, promotionalPrice: true } })
    const items: SnapshotItem[] = products.filter((p) => wanted.has(p.id)).map((p) => ({ productId: p.id, quantity: Math.round((wanted.get(p.id) || 0) * 1000) / 1000 })).sort((a, b) => a.productId.localeCompare(b.productId))
    if (!items.length) {
      await this.prisma.cartSnapshot.deleteMany({ where: { customerId } })
      return { items: 0 }
    }
    const priceOf = new Map(products.map((p) => [p.id, p.promotionalPrice && p.promotionalPrice < p.price ? p.promotionalPrice : p.price]))
    const subtotal = Math.round(items.reduce((a, i) => a + i.quantity * (priceOf.get(i.productId) || 0), 0) * 100) / 100

    const current = await this.prisma.cartSnapshot.findUnique({ where: { customerId } })
    const same = current && JSON.stringify(current.items) === JSON.stringify(items)
    if (same) return { items: items.length }
    await this.prisma.cartSnapshot.upsert({
      where: { customerId },
      create: { customerId, items, itemCount: items.length, subtotal, updatedAt: new Date() },
      update: { items, itemCount: items.length, subtotal, updatedAt: new Date() },
    })
    return { items: items.length }
  }

  /** Pedido feito: o carrinho daquele cliente acabou. */
  async clearForCustomer(customerId: string) {
    await this.prisma.cartSnapshot.deleteMany({ where: { customerId } })
  }

  @Cron('*/5 * * * *', { name: 'cart-reminder-plan' })
  async tick() {
    if (this.running) return
    this.running = true
    try {
      await this.plan()
    } catch (e) {
      this.logger.error(`plano de lembrete de carrinho: ${e instanceof Error ? e.message : e}`)
    } finally {
      this.running = false
    }
  }

  /** Poe na fila o lembrete de cada carrinho parado. Idempotente por versao do carrinho. */
  async plan(now = new Date()) {
    const s = await this.prisma.autoOfferSettings.upsert({ where: { id: 'singleton' }, update: {}, create: { id: 'singleton' } })
    const pendingItems = await this.prisma.scheduledNotification.findMany({ where: { origin: 'CARRINHO', status: { in: PENDING } } })

    if (!s.cartEnabled) {
      const r = await this.prisma.scheduledNotification.updateMany({
        where: { origin: 'CARRINHO', status: { in: PENDING } },
        data: { status: 'CANCELLED', note: 'Lembrete de carrinho desligado.', cancelledAt: now },
      })
      return { planned: 0, removed: r.count }
    }

    const snapshots = await this.prisma.cartSnapshot.findMany({ where: { updatedAt: { lte: new Date(now.getTime() - QUIET_MS) }, itemCount: { gt: 0 } } })
    const keep = new Set<string>()
    let planned = 0
    for (const snap of snapshots) {
      if (snap.subtotal < s.cartMinTotal) continue
      const key = `carrinho:${snap.customerId}:${snap.updatedAt.getTime()}`
      const existing = await this.prisma.scheduledNotification.findUnique({ where: { sourceKey: key } })
      if (existing && !PENDING.includes(existing.status)) continue // essa versao ja saiu ou foi cancelada

      const customer = await this.prisma.customer.findUnique({ where: { id: snap.customerId }, select: { name: true, blocked: true } })
      if (!customer || customer.blocked) continue
      const bought = await this.prisma.order.count({ where: { customerId: snap.customerId, createdAt: { gt: snap.updatedAt }, status: DONE_ORDER } })
      if (bought) {
        await this.prisma.cartSnapshot.deleteMany({ where: { customerId: snap.customerId } })
        continue
      }
      if (!existing) {
        const recent = await this.prisma.notification.count({
          where: { customerId: snap.customerId, source: 'CART', createdAt: { gte: new Date(now.getTime() - s.cartCooldownDays * 86_400_000) } },
        })
        if (recent) continue
      }

      const items = snap.items as SnapshotItem[]
      const products = await this.prisma.product.findMany({
        where: { id: { in: items.map((i) => i.productId) } },
        select: { id: true, name: true, titleMask: true, ean: true, price: true, promotionalPrice: true },
      })
      const value = (p: (typeof products)[number]) => (items.find((i) => i.productId === p.id)?.quantity || 0) * (p.promotionalPrice && p.promotionalPrice < p.price ? p.promotionalPrice : p.price)
      const main = [...products].sort((a, b) => value(b) - value(a))[0]
      if (!main) continue
      const ctx = { name: customer.name, product: shortProductName(main.titleMask || main.name), itemCount: snap.itemCount, subtotal: snap.subtotal }
      const sendAt = new Date(Math.max(snap.updatedAt.getTime() + s.cartDelayMinutes * 60_000, now.getTime()))
      const data = {
        type: 'CAMPAIGN',
        title: renderCartTemplate(s.cartTitle, ctx).slice(0, 80),
        body: renderCartTemplate(s.cartBody, ctx).slice(0, 180),
        url: '/carrinho',
        customerId: snap.customerId,
        audienceLabel: customer.name,
        imageUrl: s.cartImage && main.ean ? `/uploads/products/${main.ean}.webp` : null,
        productId: main.id,
        respectHours: true,
        sendAt,
        // Carrinho parado ha mais de um dia depois da hora: o lembrete perde o sentido.
        expiresAt: new Date(snap.updatedAt.getTime() + s.cartDelayMinutes * 60_000 + 24 * 3_600_000),
        meta: {
          customerId: snap.customerId,
          customer: customer.name,
          snapshotAt: snap.updatedAt.toISOString(),
          itemCount: snap.itemCount,
          subtotal: snap.subtotal,
          items: products
            .sort((a, b) => value(b) - value(a))
            .slice(0, 5)
            .map((p) => ({ name: shortProductName(p.titleMask || p.name), quantity: items.find((i) => i.productId === p.id)?.quantity ?? 0 })),
        },
      }
      if (!existing) {
        await this.prisma.scheduledNotification.create({ data: { ...data, origin: 'CARRINHO', sourceKey: key, status: s.cartApproval ? 'PENDING_APPROVAL' : 'SCHEDULED' } })
        planned += 1
      } else if (!existing.editedAt) {
        await this.prisma.scheduledNotification.update({ where: { id: existing.id }, data })
      }
      keep.add(key)
    }

    // O que estava na fila e nao vale mais (mexeu no carrinho, esvaziou, comprou).
    let removed = 0
    for (const p of pendingItems) {
      if (p.sourceKey && keep.has(p.sourceKey)) continue
      if (p.editedAt) {
        await this.prisma.scheduledNotification.update({ where: { id: p.id }, data: { status: 'CANCELLED', cancelledAt: now, note: 'O carrinho mudou, foi esvaziado ou virou pedido.' } })
      } else {
        await this.prisma.scheduledNotification.delete({ where: { id: p.id } })
      }
      removed += 1
    }
    return { planned, removed }
  }

  /** Resultado dos ultimos 30 dias: lembretes, aberturas e carrinhos que viraram pedido em 48 h. */
  async stats() {
    const rows = await this.prisma.$queryRaw<Array<{ sent: bigint; opened: bigint; recovered: bigint; revenue: number | null }>>`
      WITH n AS (SELECT * FROM notifications WHERE source = 'CART' AND "createdAt" > now() - interval '30 days'),
      o AS (
        SELECT DISTINCT ord.id, ord.total FROM n
        JOIN orders ord ON ord."customerId" = n."customerId" AND ord."createdAt" > n."createdAt" AND ord."createdAt" <= n."createdAt" + interval '48 hours'
          AND ord.status NOT IN ('CANCELLED','REFUNDED')
      )
      SELECT (SELECT COUNT(*) FROM n) AS sent,
        (SELECT COUNT(*) FROM n WHERE read OR "clickedAt" IS NOT NULL) AS opened,
        (SELECT COUNT(*) FROM o) AS recovered,
        (SELECT COALESCE(SUM(total), 0) FROM o)::float AS revenue`
    const r = rows[0]
    return { sent: Number(r?.sent ?? 0), opened: Number(r?.opened ?? 0), recovered: Number(r?.recovered ?? 0), revenue: Number(r?.revenue ?? 0) }
  }
}
