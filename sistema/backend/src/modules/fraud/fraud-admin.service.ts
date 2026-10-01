import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../common/prisma.service'

const mask = (v: string, keep = 3) => (v.length > keep + 2 ? `${v.slice(0, keep)}${'•'.repeat(Math.max(0, v.length - keep - 2))}${v.slice(-2)}` : v)
const KIND_LABEL: Record<string, string> = { DEVICE: 'mesmo aparelho', DEVICE_KEY: 'mesmo aparelho e rede', EMAIL: 'mesmo e-mail' }
const VECTOR_LABEL: Record<string, string> = {
  FIRST_PURCHASE: 'Primeira compra negada',
  COUPON: 'Cupom reaproveitado',
  BLOCKED: 'Tentativa de cliente bloqueado',
  PRICE_DIVERGED: 'Preço mudou antes de gravar',
  WHATSAPP: 'Frete grátis: WhatsApp repetido',
  DEVICE: 'Frete grátis: aparelho repetido',
  IP: 'Frete grátis: IP repetido',
  ADDRESS: 'Frete grátis: endereço repetido',
  VELOCITY: 'Muitos pedidos em pouco tempo',
}

/** Tela Antifraude do admin (01/10/2026). */
@Injectable()
export class FraudAdminService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(tenantId: string, days = 30) {
    const since = new Date(Date.now() - days * 86_400_000)
    const [assessed, riskOrders, logs, blocks, shared] = await Promise.all([
      this.prisma.order.groupBy({ by: ['riskLevel'], where: { tenantId, createdAt: { gte: since }, riskLevel: { not: null } }, _count: { _all: true } }),
      this.prisma.order.findMany({
        where: { tenantId, createdAt: { gte: since }, riskLevel: { in: ['HIGH', 'MEDIUM'] } },
        select: { id: true, erpDav: true, total: true, status: true, createdAt: true, riskScore: true, riskLevel: true, riskReasons: true, riskReviewedAt: true, customer: { select: { id: true, name: true, blocked: true } } },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      this.prisma.fraudLog.findMany({ where: { tenantId, createdAt: { gte: since } }, orderBy: { createdAt: 'desc' }, take: 100 }),
      this.prisma.fraudBlock.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' } }),
      // Identificador forte usado por mais de uma conta: a mesma pessoa.
      this.prisma.$queryRaw<Array<{ kind: string; value: string; ids: string[] }>>`
        SELECT kind, value, array_agg(DISTINCT "customerId") AS ids
        FROM identity_signals
        WHERE "tenantId" = ${tenantId} AND kind IN ('DEVICE', 'DEVICE_KEY', 'EMAIL')
        GROUP BY kind, value
        HAVING COUNT(DISTINCT "customerId") > 1`,
    ])

    // Contas ligadas: componentes conexos do grafo (union-find).
    const parent = new Map<string, string>()
    const find = (x: string): string => {
      if (!parent.has(x)) parent.set(x, x)
      const p = parent.get(x)!
      if (p === x) return x
      const r = find(p)
      parent.set(x, r)
      return r
    }
    const via = new Map<string, Set<string>>()
    for (const row of shared) {
      const [first, ...rest] = row.ids
      for (const id of rest) parent.set(find(id), find(first))
      for (const id of row.ids) via.set(id, (via.get(id) || new Set()).add(KIND_LABEL[row.kind] || row.kind))
    }
    const groups = new Map<string, string[]>()
    for (const id of parent.keys()) groups.set(find(id), [...(groups.get(find(id)) || []), id])
    const clusterIds = [...groups.values()].filter((g) => g.length > 1)
    const allIds = clusterIds.flat()
    const [customers, orderCounts, usages] = allIds.length
      ? await Promise.all([
          this.prisma.customer.findMany({ where: { id: { in: allIds } }, select: { id: true, name: true, cpf: true, whatsapp: true, blocked: true, createdAt: true } }),
          this.prisma.order.groupBy({ by: ['customerId'], where: { customerId: { in: allIds }, status: { notIn: ['CANCELLED', 'REFUNDED'] } }, _count: { _all: true } }),
          this.prisma.promotionUsage.groupBy({ by: ['customerId'], where: { customerId: { in: allIds }, orderId: { not: null } }, _count: { _all: true } }),
        ])
      : [[], [], []]
    const byId = new Map(customers.map((c) => [c.id, c]))
    const ordersOf = new Map(orderCounts.map((o) => [o.customerId, o._count._all]))
    const couponsOf = new Map(usages.map((u) => [u.customerId as string, u._count._all]))
    const clusters = clusterIds
      .map((ids) => ({
        via: [...new Set(ids.flatMap((id) => [...(via.get(id) || [])]))],
        accounts: ids.map((id) => {
          const c = byId.get(id)
          return {
            customerId: id,
            name: c?.name ?? '—',
            cpf: c ? mask(c.cpf) : '',
            whatsapp: c ? mask(c.whatsapp, 4) : '',
            blocked: Boolean(c?.blocked),
            createdAt: c?.createdAt ?? null,
            orders: ordersOf.get(id) ?? 0,
            coupons: couponsOf.get(id) ?? 0,
          }
        }),
      }))
      .map((c) => ({ ...c, coupons: c.accounts.reduce((a, x) => a + x.coupons, 0) }))
      .sort((a, b) => b.coupons - a.coupons || b.accounts.length - a.accounts.length)

    const logCustomers = await this.prisma.customer.findMany({
      where: { id: { in: [...new Set(logs.map((l) => l.customerId).filter((x): x is string => Boolean(x)))] } },
      select: { id: true, name: true },
    })
    const logName = new Map(logCustomers.map((c) => [c.id, c.name]))
    const blockCustomers = await this.prisma.customer.findMany({
      where: { id: { in: [...new Set(blocks.map((b) => b.customerId).filter((x): x is string => Boolean(x)))] } },
      select: { id: true, name: true },
    })
    const blockName = new Map(blockCustomers.map((c) => [c.id, c.name]))
    const blockedPeople = new Map<string, { customerId: string; name: string; reason: string | null; at: Date; identifiers: number }>()
    for (const b of blocks) {
      const key = b.customerId || b.id
      const cur = blockedPeople.get(key)
      blockedPeople.set(key, { customerId: b.customerId || '', name: blockName.get(b.customerId || '') || '—', reason: b.reason, at: cur?.at ?? b.createdAt, identifiers: (cur?.identifiers ?? 0) + 1 })
    }

    const count = (level: string) => assessed.find((a) => a.riskLevel === level)?._count._all ?? 0
    return {
      days,
      summary: {
        assessed: assessed.reduce((a, x) => a + x._count._all, 0),
        high: count('HIGH'),
        medium: count('MEDIUM'),
        pendingReview: riskOrders.filter((o) => o.riskLevel === 'HIGH' && !o.riskReviewedAt && !['CANCELLED', 'REFUNDED'].includes(o.status)).length,
        denied: logs.filter((l) => l.vector === 'FIRST_PURCHASE' || l.vector === 'COUPON' || l.vector === 'BLOCKED').length,
        linkedAccounts: allIds.length,
        blocked: blockedPeople.size,
      },
      riskOrders: riskOrders.map((o) => ({ ...o, total: Number(o.total) })),
      clusters,
      events: logs.map((l) => ({ id: l.id, kind: l.vector, label: VECTOR_LABEL[l.vector] || l.vector, customerId: l.customerId, customer: l.customerId ? logName.get(l.customerId) ?? null : null, orderId: l.orderId, at: l.createdAt })),
      blocked: [...blockedPeople.values()],
    }
  }

  async review(tenantId: string, orderId: string, adminId?: string | null) {
    await this.prisma.order.updateMany({ where: { id: orderId, tenantId }, data: { riskReviewedAt: new Date(), riskReviewedBy: adminId || null } })
    return { ok: true }
  }
}
