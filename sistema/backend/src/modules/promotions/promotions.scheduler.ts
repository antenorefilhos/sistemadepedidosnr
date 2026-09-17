import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { PromotionsService } from './promotions.service'

/**
 * Agenda a sincronizacao de encartes/campanhas do ERP e a limpeza de
 * campanhas vencidas -- mesmo padrao de ProductsSyncScheduler.
 *
 * - PROMOTIONS_SYNC_CRON_ENABLED: 'true' para habilitar (default: desabilitado).
 * - PROMOTIONS_SYNC_CRON: expressao cron do sync (default: a cada 30min).
 * - PROMOTIONS_EXPIRE_CRON: expressao cron da limpeza (default: a cada 15min).
 */
@Injectable()
export class PromotionsScheduler {
  private readonly logger = new Logger(PromotionsScheduler.name)
  private readonly enabled = String(process.env.PROMOTIONS_SYNC_CRON_ENABLED || '').toLowerCase() === 'true'
  private isRunning = false

  constructor(private readonly promotionsService: PromotionsService) {
    if (this.enabled) {
      this.logger.log('Sync automatico de encartes/campanhas HABILITADO.')
    } else {
      this.logger.log('Sync automatico de encartes/campanhas desabilitado (defina PROMOTIONS_SYNC_CRON_ENABLED=true).')
    }
  }

  @Cron(process.env.PROMOTIONS_SYNC_CRON || '*/30 * * * *', { name: 'promotions-sync' })
  async handleSync(): Promise<void> {
    if (!this.enabled || this.isRunning) return
    this.isRunning = true
    try {
      await this.promotionsService.syncFromERP()
    } catch (error) {
      this.logger.error('Falha no sync de encartes/campanhas:', error instanceof Error ? error.stack : String(error))
    } finally {
      this.isRunning = false
    }
  }

  @Cron(process.env.PROMOTIONS_EXPIRE_CRON || '*/15 * * * *', { name: 'promotions-expire' })
  async handleExpire(): Promise<void> {
    if (!this.enabled) return
    try {
      await this.promotionsService.expireCampaigns()
    } catch (error) {
      this.logger.error('Falha na limpeza de campanhas vencidas:', error instanceof Error ? error.stack : String(error))
    }
  }

  // JON-171: campanha ja cadastrada e habilitada no admin so deve aplicar
  // preco ao catalogo quando o RELOGIO cruzar startDate -- isso nao pode
  // depender de PROMOTIONS_SYNC_CRON_ENABLED (que so fala de falar com o
  // ERP), senao desligar o sync automatico tambem trava a ativacao de algo
  // que o lojista ja aprovou manualmente. Roda sempre.
  @Cron(process.env.PROMOTIONS_ACTIVATE_CRON || '*/5 * * * *', { name: 'promotions-activate' })
  async handleActivate(): Promise<void> {
    try {
      await this.promotionsService.activateCampaigns()
    } catch (error) {
      this.logger.error('Falha na ativacao de campanhas vigentes:', error instanceof Error ? error.stack : String(error))
    }
  }

  @Cron(process.env.PROMOTIONS_NOTIFY_CRON || '*/15 * * * *', { name: 'promotions-notify-lifecycle' })
  async handleNotifyLifecycle(): Promise<void> {
    try {
      await this.promotionsService.notifyCampaignLifecycle()
    } catch (error) {
      this.logger.error('Falha no aviso de inicio/fim de encarte:', error instanceof Error ? error.stack : String(error))
    }
  }
}
