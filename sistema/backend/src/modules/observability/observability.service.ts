import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../common/prisma.service'
import { MetricsRegistry } from '../../common/observability/metrics-registry'

@Injectable()
export class ObservabilityService {
  constructor(private prisma: PrismaService) {}

  async getOperationalMetrics() {
    const now = new Date()
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

    const [
      pendingOutbox,
      failedJobs,
      openDeadLetters,
      unsyncedOrders,
      failedWebhooks,
      expiredReservations,
      pendingPayments,
    ] = await Promise.all([
      this.prisma.outboxEvent.count({ where: { status: { in: ['PENDING', 'FAILED'] } } }),
      this.prisma.integrationJob.count({ where: { status: { in: ['FAILED', 'ERROR'] }, createdAt: { gte: oneDayAgo } } }),
      this.prisma.integrationDeadLetter.count({ where: { resolvedAt: null } }),
      this.prisma.outboxEvent.count({ where: { aggregate: 'ORDER', status: { in: ['PENDING', 'FAILED'] }, createdAt: { lt: oneHourAgo } } }),
      this.prisma.webhookDelivery.count({ where: { status: { in: ['FAILED', 'DEAD'] }, createdAt: { gte: oneDayAgo } } }),
      this.prisma.stockReservation.count({ where: { status: 'ACTIVE', expiresAt: { lt: now } } }),
      this.prisma.paymentTransaction.count({ where: { status: { in: ['PENDING', 'AUTHORIZED'] }, createdAt: { lt: oneHourAgo } } }),
    ])

    return {
      timestamp: now.toISOString(),
      http: MetricsRegistry.httpSummary(),
      queues: {
        accumulated: pendingOutbox,
        failedJobs,
        deadLettersOpen: openDeadLetters,
      },
      orders: {
        withoutErpSyncAboveSla: unsyncedOrders,
      },
      webhooks: {
        failed: failedWebhooks,
      },
      inventory: {
        expiredReservations,
      },
      payments: {
        pendingAboveSla: pendingPayments,
      },
    }
  }

  async getStatusPage() {
    const metrics = await this.getOperationalMetrics()
    const alerts = this.evaluateAlerts(metrics)
    return {
      status: alerts.some((alert) => alert.severity === 'critical') ? 'degraded' : 'ok',
      timestamp: metrics.timestamp,
      summary: {
        httpRequests: metrics.http.totalRequests,
        queueAccumulated: metrics.queues.accumulated,
        failedJobs: metrics.queues.failedJobs,
        deadLettersOpen: metrics.queues.deadLettersOpen,
        failedWebhooks: metrics.webhooks.failed,
        pendingPaymentsAboveSla: metrics.payments.pendingAboveSla,
      },
      alerts,
    }
  }

  async checkAlerts() {
    const metrics = await this.getOperationalMetrics()
    return { alerts: this.evaluateAlerts(metrics), metrics }
  }

  getPrometheusMetrics() {
    return MetricsRegistry.prometheus()
  }

  getRunbooks() {
    return {
      runbooks: [
        {
          key: 'erp-failure',
          trigger: 'Falha de ERP, outbox acumulado ou pedido sem sync acima do SLA',
          firstActions: [
            'Abrir /api/integrations/operations/panel',
            'Verificar dead letters e ultimo erro do conector Solidcom',
            'Reprocessar outbox/dead-letter somente apos confirmar idempotencia',
          ],
        },
        {
          key: 'checkout-error-rate',
          trigger: '5xx ou 4xx critico alto em /checkout ou /orders',
          firstActions: [
            'Filtrar logs por x-request-id/x-correlation-id',
            'Conferir estoque/reservas expiradas e paymentStatus do pedido',
            'Executar health/detail para dependencias',
          ],
        },
        {
          key: 'payment-pending-sla',
          trigger: 'Pagamento pendente acima do SLA operacional',
          firstActions: [
            'Conferir /api/integrations/payments/health',
            'Validar webhook e PaymentTransaction',
            'Nao confirmar pedido online antes de PAID/AUTHORIZED/CAPTURED',
          ],
        },
        {
          key: 'rupture-spike',
          trigger: 'Ruptura anormal ou venda perdida por produto/categoria',
          firstActions: [
            'Abrir /api/analytics/admin/operational-dashboard?dashboard=RUPTURE',
            'Usar drill-down por loja/produto/categoria',
            'Rodar reconciliacao de estoque para a loja afetada',
          ],
        },
      ],
    }
  }

  private evaluateAlerts(metrics: any) {
    const alerts: Array<{ key: string; severity: 'warning' | 'critical'; message: string; value: number }> = []
    const endpoints = metrics.http.endpoints || []
    const hasHigh5xx = endpoints.some((endpoint: any) => endpoint.error5xxRate >= 0.02 && endpoint.count >= 5)
    const hasHighCheckout4xx = endpoints.some((endpoint: any) =>
      endpoint.endpoint.includes('/checkout') && endpoint.critical4xxRate >= 0.15 && endpoint.count >= 5,
    )

    if (hasHigh5xx) alerts.push({ key: 'http-5xx-rate', severity: 'critical', message: 'Erro 5xx acima do limite', value: 1 })
    if (hasHighCheckout4xx) alerts.push({ key: 'checkout-error-rate', severity: 'warning', message: 'Checkout error rate alto', value: 1 })
    if (metrics.queues.accumulated > 100) alerts.push({ key: 'queue-accumulated', severity: 'warning', message: 'Fila acumulada acima do limite', value: metrics.queues.accumulated })
    if (metrics.queues.failedJobs > 0 || metrics.queues.deadLettersOpen > 0) alerts.push({ key: 'integration-failing', severity: 'critical', message: 'Integracao falhando ou DLQ aberta', value: metrics.queues.failedJobs + metrics.queues.deadLettersOpen })
    if (metrics.orders.withoutErpSyncAboveSla > 0) alerts.push({ key: 'order-unsynced-sla', severity: 'critical', message: 'Pedido sem sync ERP acima do SLA', value: metrics.orders.withoutErpSyncAboveSla })
    if (metrics.payments.pendingAboveSla > 0) alerts.push({ key: 'payment-pending-sla', severity: 'warning', message: 'Pagamento pendente acima do SLA', value: metrics.payments.pendingAboveSla })
    if (metrics.inventory.expiredReservations > 0) alerts.push({ key: 'expired-reservations', severity: 'warning', message: 'Reservas expiradas ainda ativas', value: metrics.inventory.expiredReservations })
    if (metrics.webhooks.failed > 0) alerts.push({ key: 'webhook-failing', severity: 'warning', message: 'Webhooks falhos ou mortos', value: metrics.webhooks.failed })

    return alerts
  }
}
