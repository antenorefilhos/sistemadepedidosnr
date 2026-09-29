import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../common/prisma.service'

/**
 * Clientes no admin (29/09/2026): a tela antiga baixava TODOS os pedidos so para
 * contar, e contava os cancelados junto (26 pedidos onde 10 eram validos). Aqui
 * o servidor devolve cada cliente ja com o que ajuda a decidir: quanto comprou,
 * quando comprou por ultimo, se recebe aviso, se tem senha.
 */
// E-mail inventado no checkout convidado (guest.<whatsapp>@checkout.local): nao e contato.
const realEmail = (email?: string | null) => (email && !email.endsWith('@checkout.local') ? email : null)

@Injectable()
export class CustomersAdminService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(tenantId: string) {
    const [customers, stats, push] = await Promise.all([
      this.prisma.customer.findMany({
        where: { tenantId },
        select: {
          id: true,
          name: true,
          cpf: true,
          whatsapp: true,
          email: true,
          password: true,
          blocked: true,
          origin: true,
          createdAt: true,
          addresses: { select: { neighborhood: true, isDefault: true }, orderBy: { isDefault: 'desc' }, take: 1 },
        },
        orderBy: { createdAt: 'desc' },
        take: 5000,
      }),
      this.prisma.$queryRaw<Array<{ customerId: string; orders: bigint; spent: number; last: Date; first: Date; cancelled: bigint }>>`
        SELECT "customerId",
          COUNT(*) FILTER (WHERE status NOT IN ('CANCELLED','REFUNDED')) AS orders,
          COALESCE(SUM(total) FILTER (WHERE status NOT IN ('CANCELLED','REFUNDED')), 0)::float AS spent,
          MAX("createdAt") FILTER (WHERE status NOT IN ('CANCELLED','REFUNDED')) AS last,
          MIN("createdAt") FILTER (WHERE status NOT IN ('CANCELLED','REFUNDED')) AS first,
          COUNT(*) FILTER (WHERE status IN ('CANCELLED','REFUNDED')) AS cancelled
        FROM orders WHERE "tenantId" = ${tenantId} GROUP BY 1`,
      this.prisma.pushSubscription.groupBy({ by: ['customerId'], where: { customerId: { not: null } }, _count: { _all: true } }),
    ])
    const statsBy = new Map(stats.map((s) => [s.customerId, s]))
    const pushBy = new Map(push.map((p) => [p.customerId, p._count._all]))

    return customers.map((c) => {
      const s = statsBy.get(c.id)
      const orders = Number(s?.orders || 0)
      return {
        id: c.id,
        name: c.name,
        cpf: c.cpf,
        whatsapp: c.whatsapp,
        email: realEmail(c.email),
        hasPassword: Boolean(c.password),
        blocked: c.blocked,
        origin: c.origin,
        createdAt: c.createdAt,
        neighborhood: c.addresses[0]?.neighborhood || null,
        orders,
        cancelled: Number(s?.cancelled || 0),
        spent: Number(s?.spent || 0),
        avgTicket: orders ? Number(s!.spent) / orders : 0,
        lastOrderAt: s?.last || null,
        firstOrderAt: s?.first || null,
        pushDevices: pushBy.get(c.id) || 0,
      }
    })
  }

  async detail(id: string, tenantId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id, tenantId },
      select: {
        id: true,
        name: true,
        cpf: true,
        whatsapp: true,
        email: true,
        password: true,
        blocked: true,
        blockedReason: true,
        origin: true,
        createdAt: true,
        addresses: { orderBy: { isDefault: 'desc' } },
      },
    })
    if (!customer) throw new NotFoundException('Cliente não encontrado')

    const [orders, top, push] = await Promise.all([
      this.prisma.order.findMany({
        where: { customerId: id },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: { id: true, erpDav: true, status: true, total: true, createdAt: true, fulfillmentType: true, _count: { select: { items: true } } },
      }),
      this.prisma.$queryRaw<Array<{ productId: string; name: string; ean: string; times: bigint }>>`
        SELECT i."productId", COALESCE(p."titleMask", p.name) AS name, p.ean, COUNT(DISTINCT o.id) AS times
        FROM order_items i JOIN orders o ON o.id = i."orderId" JOIN products p ON p.id = i."productId"
        WHERE o."customerId" = ${id} AND o.status NOT IN ('CANCELLED','REFUNDED')
        GROUP BY 1, 2, 3 ORDER BY times DESC, name LIMIT 8`,
      this.prisma.pushSubscription.count({ where: { customerId: id } }),
    ])
    const valid = orders.filter((o) => !['CANCELLED', 'REFUNDED'].includes(o.status))
    const spent = valid.reduce((a, o) => a + Number(o.total || 0), 0)
    const { password, email, ...rest } = customer

    return {
      ...rest,
      email: realEmail(email),
      hasPassword: Boolean(password),
      pushDevices: push,
      summary: {
        orders: valid.length,
        cancelled: orders.length - valid.length,
        spent,
        avgTicket: valid.length ? spent / valid.length : 0,
        lastOrderAt: valid[0]?.createdAt || null,
        firstOrderAt: valid[valid.length - 1]?.createdAt || null,
      },
      orders: orders.map((o) => ({ id: o.id, dav: o.erpDav, status: o.status, total: o.total, createdAt: o.createdAt, items: o._count.items, pickup: o.fulfillmentType === 'PICKUP' })),
      topProducts: top.map((t) => ({ productId: t.productId, name: t.name, ean: t.ean, times: Number(t.times) })),
    }
  }
}

