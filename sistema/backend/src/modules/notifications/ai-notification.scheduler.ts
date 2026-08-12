import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { AiNotificationService } from './ai-notification.service'
import { IntegrationModulesService } from '../integrations/integration-modules.service'

/**
 * Agenda o ciclo de notificacao automatica por IA (produtos em promocao
 * recente -> NVIDIA NIM decide se notifica -> broadcast).
 *
 * O liga/desliga fica no interruptor persistido no banco (modulo
 * 'ai-notifications', mesmo mecanismo dos conectores de integracao,
 * controlavel na tela de Notificacoes do admin sem precisar redeploy).
 * AI_NOTIFICATIONS_CRON_ENABLED so serve de valor inicial/fallback antes
 * de qualquer toggle ser salvo. AI_NOTIFICATIONS_CRON define a expressao
 * cron (default: 3x/dia -- 9h, 13h, 18h).
 */
@Injectable()
export class AiNotificationScheduler {
  private readonly logger = new Logger(AiNotificationScheduler.name)
  private isRunning = false

  constructor(
    private readonly aiNotificationService: AiNotificationService,
    private readonly integrationModules: IntegrationModulesService,
  ) {}

  @Cron(process.env.AI_NOTIFICATIONS_CRON || '0 9,13,18 * * *', { name: 'ai-notification-cycle' })
  async handleCycle(): Promise<void> {
    const enabled = await this.integrationModules.isEnabled('ai-notifications')
    if (!enabled) return

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
