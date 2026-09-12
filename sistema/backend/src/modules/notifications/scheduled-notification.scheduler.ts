import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { NotificationsService } from './notifications.service'

/**
 * Dispara broadcasts agendados (admin/broadcast com "sendAt" no futuro)
 * quando a hora chega. Mesmo padrao de PromotionsScheduler.
 */
@Injectable()
export class ScheduledNotificationScheduler {
  private readonly logger = new Logger(ScheduledNotificationScheduler.name)
  private isRunning = false

  constructor(private readonly notificationsService: NotificationsService) {}

  @Cron('*/5 * * * *', { name: 'scheduled-notifications' })
  async handleDue(): Promise<void> {
    if (this.isRunning) return
    this.isRunning = true
    try {
      const { count } = await this.notificationsService.runDueScheduledBroadcasts()
      if (count > 0) this.logger.log(`${count} broadcast(s) agendado(s) disparado(s).`)
    } catch (error) {
      this.logger.error('Falha ao disparar broadcasts agendados:', error instanceof Error ? error.stack : String(error))
    } finally {
      this.isRunning = false
    }
  }
}
