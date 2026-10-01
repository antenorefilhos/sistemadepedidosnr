import { Injectable } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { PrismaService } from '../../common/prisma.service'
import { winstonLogger } from '../../common/logger'
import { IntegrationModulesService } from './integration-modules.service'
import { OrderOrchestrationService } from './order-orchestration.service'

/** ~2 h de tentativas a cada 10 min; depois fica para o botao Reenviar da tela Integracoes. */
export const MAX_AUTO_SYNC_FAILURES = 12

/**
 * Pedido sem DAV e reenviado sozinho ao ERP (01/10/2026). Antes a falha ia
 * para uma fila de outbox que nunca enviava nada, e o pedido ficava sem DAV
 * (o separador nao acha no PDV) sem ninguem saber. A AntenorApi e idempotente
 * por cdEcomPedido: reenviar devolve o mesmo DAV, nao cria pedido novo.
 */
@Injectable()
export class OrderSyncRetryScheduler {
  private isRunning = false

  constructor(
    private readonly prisma: PrismaService,
    private readonly integrationModules: IntegrationModulesService,
    private readonly orderOrchestration: OrderOrchestrationService,
  ) {}

  @Cron('*/10 * * * *', { name: 'order-sync-retry' })
  async handle(): Promise<number> {
    if (this.isRunning || !(await this.integrationModules.isEnabled('antenorapi'))) return 0
    this.isRunning = true
    try {
      const now = Date.now()
      // 3 min de folga: o envio normal acontece logo apos criar o pedido.
      const pendentes = await this.prisma.order.findMany({
        where: { erpDav: null, status: { notIn: ['CANCELLED', 'REFUNDED'] }, createdAt: { gte: new Date(now - 48 * 3_600_000), lte: new Date(now - 3 * 60_000) } },
        select: { id: true },
        orderBy: { createdAt: 'asc' },
        take: 20,
      })
      let enviados = 0
      for (const { id } of pendentes) {
        const falhas = await this.prisma.auditLog.count({ where: { entityId: id, action: 'SYNC_ORDER_FAILED' } })
        if (falhas >= MAX_AUTO_SYNC_FAILURES) continue
        const r = await this.orderOrchestration.retryOrderSync(id).catch((e: unknown) => ({ success: false, reason: String(e) }))
        if ('success' in r && r.success) enviados++
        winstonLogger.info('order_sync_retry', { orderId: id, success: 'success' in r ? r.success : false, reason: r.reason })
      }
      return enviados
    } finally {
      this.isRunning = false
    }
  }
}
