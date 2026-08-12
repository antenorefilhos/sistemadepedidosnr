import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { AiNotificationService } from './ai-notification.service'

/**
 * Agenda o ciclo de notificacao automatica por IA (produtos em promocao
 * recente -> NVIDIA NIM decide se notifica -> broadcast).
 *
 * Controlado por variaveis de ambiente, seguindo o mesmo padrao do sync do
 * ERP (ProductsSyncScheduler): desabilitado por padrao, trava em memoria
 * contra execucao concorrente.
 * - AI_NOTIFICATIONS_CRON_ENABLED: 'true' para habilitar.
 * - AI_NOTIFICATIONS_CRON: expressao cron (default: 3x/dia -- 9h, 13h, 18h).
 */
@Injectable()
export class AiNotificationScheduler {
  private readonly logger = new Logger(AiNotificationScheduler.name)
  private readonly enabled = String(process.env.AI_NOTIFICATIONS_CRON_ENABLED || '').toLowerCase() === 'true'
  private isRunning = false

  constructor(private readonly aiNotificationService: AiNotificationService) {
    if (this.enabled) {
      this.logger.log(`Notificacao automatica por IA HABILITADA (cron: ${process.env.AI_NOTIFICATIONS_CRON || '0 9,13,18 * * *'}).`)
    } else {
      this.logger.log('Notificacao automatica por IA desabilitada (defina AI_NOTIFICATIONS_CRON_ENABLED=true para ativar).')
    }
  }

  @Cron(process.env.AI_NOTIFICATIONS_CRON || '0 9,13,18 * * *', { name: 'ai-notification-cycle' })
  async handleCycle(): Promise<void> {
    if (!this.enabled) return
    if (this.isRunning) {
      this.logger.warn('Ciclo de notificacao IA ignorado: ciclo anterior ainda em andamento.')
      return
    }

    this.isRunning = true
    try {
      await this.aiNotificationService.runCycle()
    } catch (error) {
      this.logger.error('Falha no ciclo de notificacao IA:', error instanceof Error ? error.stack : String(error))
    } finally {
      this.isRunning = false
    }
  }
}
