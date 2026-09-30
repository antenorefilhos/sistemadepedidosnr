import { Injectable } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { PrismaService } from '../../common/prisma.service'
import { IntegrationModulesService } from './integration-modules.service'
import { OrderOrchestrationService } from './order-orchestration.service'

/**
 * Busca na AntenorApi o que o caixa cobrou de cada pedido faturado (itens,
 * forma de pagamento, cupom) e guarda como evento do pedido, que a tela
 * Pagamentos le.
 *
 * O `markInvoiced` ja tenta na hora; isto cobre o que falhou (AntenorApi fora,
 * cupom ainda nao sincronizado) e os pedidos faturados antes de 30/09/2026.
 * Liga junto com o conector AntenorApi, sem variavel propria.
 */
@Injectable()
export class PdvPaymentScheduler {
  private isRunning = false

  constructor(
    private readonly prisma: PrismaService,
    private readonly integrationModules: IntegrationModulesService,
    private readonly orderOrchestration: OrderOrchestrationService,
  ) {}

  @Cron('*/15 * * * *', { name: 'pdv-payment-capture' })
  async handle(): Promise<number> {
    if (this.isRunning || !(await this.integrationModules.isEnabled('antenorapi'))) return 0
    this.isRunning = true
    try {
      const pendentes = await this.prisma.$queryRaw<Array<{ id: string }>>`
        SELECT o.id FROM orders o
        WHERE o."createdAt" > now() - interval '45 days'
          AND o.status NOT IN ('CANCELLED', 'REFUNDED')
          AND EXISTS (SELECT 1 FROM order_events e WHERE e."orderId" = o.id AND e.type = 'order.invoiced')
          AND NOT EXISTS (SELECT 1 FROM order_events e WHERE e."orderId" = o.id AND e.type IN ('order.invoice_reconciled', 'order.invoice_diverged'))
        ORDER BY o."createdAt" LIMIT 25`
      let gravados = 0
      for (const pedido of pendentes) {
        const r = await this.orderOrchestration.reconcileInvoicedOrder(undefined, pedido.id).catch(() => null)
        if (r && 'reconciliacao' in r) gravados++
      }
      return gravados
    } finally {
      this.isRunning = false
    }
  }
}
