import { Injectable } from '@nestjs/common'
import axios from 'axios'
import { PrismaService } from '../../common/prisma.service'
import { IntegrationModulesService } from './integration-modules.service'
import { IntegrationsService } from './integrations.service'
import { MAX_AUTO_SYNC_FAILURES } from './order-sync-retry.scheduler'

const parse = (raw: string | null) => {
  try {
    return raw ? (JSON.parse(raw) as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

/**
 * Tela Integracoes (01/10/2026): o que o lojista precisa saber do ERP -- se
 * responde, quando o catalogo foi sincronizado, pedido que ficou sem DAV,
 * cancelamento que nao chegou ao caixa e se o caixa esta mandando os status.
 * Tudo sai do audit_logs que o orquestrador ja grava (entity ORDER_SYNC_SOLIDCOM).
 */
@Injectable()
export class IntegrationsOverviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly modules: IntegrationModulesService,
    private readonly integrations: IntegrationsService,
  ) {}

  async overview(days = 30) {
    const since = new Date(Date.now() - days * 86_400_000)
    const [erp, lastSync, orders, noDav, cancelLogs, pdvStatus, modules, crm, fiscal, payments] = await Promise.all([
      this.erpHealth(),
      this.prisma.auditLog.findFirst({ where: { action: 'SYNC_PRODUCTS' }, orderBy: { createdAt: 'desc' }, select: { createdAt: true, changes: true } }),
      this.prisma.order.groupBy({
        by: ['status'],
        where: { createdAt: { gte: since } },
        _count: { _all: true },
      }),
      this.prisma.order.findMany({
        where: { erpDav: null, status: { notIn: ['CANCELLED', 'REFUNDED'] }, createdAt: { gte: since } },
        select: { id: true, createdAt: true, total: true, status: true, customer: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.auditLog.findMany({
        where: { entity: 'ORDER_SYNC_SOLIDCOM', action: { startsWith: 'CANCEL_ORDER_' }, createdAt: { gte: since } },
        select: { entityId: true, action: true, createdAt: true, changes: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.auditLog.aggregate({
        where: { entity: 'ORDER_SYNC_SOLIDCOM', action: { startsWith: 'ERP_STATUS_' }, createdAt: { gte: since } },
        _count: { _all: true },
        _max: { createdAt: true },
      }),
      this.modules.list(),
      this.integrations.getCrmHealth().catch(() => null),
      this.integrations.getFiscalHealth().catch(() => null),
      this.integrations.getPaymentsHealth().catch(() => null),
    ])

    const valid = orders.filter((o) => !['CANCELLED', 'REFUNDED'].includes(o.status)).reduce((a, o) => a + o._count._all, 0)

    // Ultimo motivo e quantas falhas de cada pedido sem DAV.
    const failures = noDav.length
      ? await this.prisma.auditLog.findMany({
          where: { entityId: { in: noDav.map((o) => o.id) }, action: 'SYNC_ORDER_FAILED' },
          select: { entityId: true, changes: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
        })
      : []

    // Cancelamento: vale o ultimo resultado de cada pedido.
    const lastCancel = new Map<string, (typeof cancelLogs)[number]>()
    for (const log of cancelLogs) if (log.entityId && !lastCancel.has(log.entityId)) lastCancel.set(log.entityId, log)
    const cancelIds = [...lastCancel.keys()]
    const cancelOrders = cancelIds.length
      ? await this.prisma.order.findMany({ where: { id: { in: cancelIds } }, select: { id: true, erpDav: true, total: true, customer: { select: { name: true } } } })
      : []
    const orderById = new Map(cancelOrders.map((o) => [o.id, o]))
    const cancelRow = (log: (typeof cancelLogs)[number]) => {
      const o = orderById.get(log.entityId!)
      const c = parse(log.changes)
      return { orderId: log.entityId!, dav: o?.erpDav ?? null, customer: o?.customer?.name ?? null, total: Number(o?.total ?? 0), at: log.createdAt, reason: (c.error as string) || (c.reason as string) || null }
    }

    const sync = parse(lastSync?.changes ?? null)
    const configured: Record<string, boolean | null> = {
      hubspot: crm ? Boolean(crm.configured) : null,
      nfe: fiscal ? Boolean(fiscal.configured) : null,
      payments: payments ? Boolean(payments.configured) : null,
    }

    return {
      days,
      erp,
      catalog: lastSync
        ? { at: lastSync.createdAt, products: Number(sync.products ?? 0) || null, synced: Number(sync.synced ?? 0) || null, errors: Number(sync.errors ?? 0) }
        : null,
      orders: {
        total: valid,
        withDav: valid - noDav.length,
        withoutDav: noDav.map((o) => {
          const mine = failures.filter((f) => f.entityId === o.id)
          return {
            orderId: o.id,
            createdAt: o.createdAt,
            customer: o.customer?.name ?? null,
            total: Number(o.total),
            status: o.status,
            failures: mine.length,
            autoRetry: mine.length < MAX_AUTO_SYNC_FAILURES,
            reason: mine[0] ? ((parse(mine[0].changes).reason as string) ?? null) : null,
          }
        }),
      },
      cancellations: {
        ok: [...lastCancel.values()].filter((l) => l.action === 'CANCEL_ORDER_SUCCESS' || l.action === 'CANCEL_ORDER_SKIPPED_NOT_IN_ERP').length,
        failed: [...lastCancel.values()].filter((l) => l.action === 'CANCEL_ORDER_FAILED').map(cancelRow),
        invoiced: [...lastCancel.values()].filter((l) => l.action === 'CANCEL_ORDER_REFUSED_ALREADY_INVOICED').map(cancelRow),
      },
      pdvStatus: { events: pdvStatus._count._all, lastAt: pdvStatus._max.createdAt },
      modules: modules.map((m) => ({ ...m, configured: m.key in configured ? configured[m.key] : true })),
    }
  }

  /** Mesma checagem do /health/detail: GET <ANTENOR_API_URL>/health com 5 s. */
  private async erpHealth() {
    const url = process.env.ANTENOR_API_URL
    if (!url) return { status: 'down' as const, latencyMs: null, detail: 'ANTENOR_API_URL nao configurada' }
    const start = Date.now()
    try {
      await axios.get(`${url}/health`, { timeout: 5000 })
      return { status: 'ok' as const, latencyMs: Date.now() - start, detail: null }
    } catch (err) {
      const latencyMs = Date.now() - start
      if (axios.isAxiosError(err) && err.response) return { status: 'degraded' as const, latencyMs, detail: `HTTP ${err.response.status}` }
      return { status: 'down' as const, latencyMs, detail: 'sem resposta' }
    }
  }
}
