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
}
