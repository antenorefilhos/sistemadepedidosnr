import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { PrismaService } from '../../common/prisma.service'
import { IntegrationModulesService } from './integration-modules.service'
import { AntenorApiService } from './antenor-api.service'
import { OrderOrchestrationService } from './order-orchestration.service'

// Mesma lista de status finais usada em data-privacy.service.ts -- pedido
// nesses estados nao pode mais ser cancelado, nao vale a pena consultar.
const FINAL_ORDER_STATUSES = ['CANCELLED', 'COMPLETED', 'DELIVERED', 'REFUNDED', 'FAILED_SYNC']

const CANCELADO_NO_ERP = ['CANCELADO_NA_RETAGUARDA', 'CANCELADO_NO_PDV']

/**
 * Detecta pedido cancelado no PDV/retaguarda que o site ainda nao sabe.
 *
 * `markCancelledInErp` (order-orchestration.service.ts) sempre existiu como
 * endpoint manual. Ate 08/09/2026 a unica forma de disparar era alguem notar
 * a divergencia e chamar na mao -- confirmado ao vivo duas vezes no mesmo
 * dia (DAV 102073 e 102076): o Solidcom ja mostrava cancelado, o pedido
 * aqui continuava ativo, aparecendo pro separador/entregador como se nada
 * tivesse acontecido.
 *
 * Controlado por variavel de ambiente, no mesmo padrao do sync de produtos:
 * - PDV_CANCELLATION_CRON_ENABLED: 'true' pra habilitar (default: desligado).
 * - PDV_CANCELLATION_CRON: expressao cron (default: a cada 5 minutos).
 */
@Injectable()
export class PdvCancellationScheduler {
  private readonly logger = new Logger(PdvCancellationScheduler.name)
  private readonly enabled = String(process.env.PDV_CANCELLATION_CRON_ENABLED || '').toLowerCase() === 'true'
  private isRunning = false

  constructor(
    private readonly prisma: PrismaService,
    private readonly integrationModules: IntegrationModulesService,
    private readonly antenorApi: AntenorApiService,
    private readonly orderOrchestration: OrderOrchestrationService,
  ) {
    if (this.enabled) {
      this.logger.log(
        `Deteccao automatica de cancelamento no PDV HABILITADA (cron: ${process.env.PDV_CANCELLATION_CRON || '*/5 * * * *'}).`,
      )
    } else {
      this.logger.log('Deteccao automatica de cancelamento no PDV desabilitada (PDV_CANCELLATION_CRON_ENABLED=true pra ativar).')
    }
  }

  @Cron(process.env.PDV_CANCELLATION_CRON || '*/5 * * * *', { name: 'pdv-cancellation-detection' })
  async handleCheck(): Promise<void> {
    if (!this.enabled) return
    if (!(await this.integrationModules.isEnabled('antenorapi'))) return

    if (this.isRunning) {
      this.logger.warn('Verificacao de cancelamento ignorada: uma anterior ainda esta em andamento.')
      return
    }

    this.isRunning = true
    try {
      // Janela de 30 dias e so defesa: pedido ativo de verdade e sempre
      // recente, isso limita o escopo se algo ficar preso sem finalizar.
      const desde = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      const candidatos = await this.prisma.order.findMany({
        where: {
          erpDav: { not: null },
          status: { notIn: FINAL_ORDER_STATUSES },
          createdAt: { gte: desde },
        },
        select: { id: true, erpDav: true },
        take: 200,
      })

      if (candidatos.length === 0) return

      let cancelados = 0
      for (const pedido of candidatos) {
        try {
          const statusErp = await this.antenorApi.getOrderStatus(pedido.erpDav as string)
          if (!statusErp || !CANCELADO_NO_ERP.includes(statusErp.statusGeral)) continue

          await this.orderOrchestration.markCancelledInErp(undefined, pedido.id, {
            canceladoEm: statusErp.cancelamento?.canceladoEm,
            motivo: statusErp.cancelamento?.motivo || 'Cancelado na retaguarda/PDV (detectado automaticamente)',
            dav: pedido.erpDav as string,
          })
          cancelados++
        } catch (error) {
          // Um pedido com falha (AntenorApi fora do ar, DAV nao encontrado)
          // nao pode travar a verificacao dos outros candidatos do lote.
          this.logger.warn(
            `Falha ao verificar cancelamento do pedido ${pedido.id} (DAV ${pedido.erpDav}): ${error instanceof Error ? error.message : String(error)}`,
          )
        }
      }

      if (cancelados > 0) {
        this.logger.log(`Deteccao automatica: ${cancelados} pedido(s) cancelado(s) no PDV refletido(s) no site.`)
      }
    } finally {
      this.isRunning = false
    }
  }
}
