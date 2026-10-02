import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { NotificationsService } from './notifications.service'

/**
 * Despacha a fila de envios (encarte, oferta personalizada e agendado manual)
 * quando a hora chega. Ver NotificationsService.dispatchDueQueue.
 */
@Injectable()
export class ScheduledNotificationScheduler {
  private readonly logger = new Logger(ScheduledNotificationScheduler.name)
  private isRunning = false

  constructor(private readonly notificationsService: NotificationsService) {}

  // Fila de envios (02/10/2026): a cada minuto, para "17:50" sair as 17:50.
  @Cron('* * * * *', { name: 'scheduled-notifications' })
  async handleDue(): Promise<void> {
    if (this.isRunning) return
    this.isRunning = true
    try {
      const { count } = await this.notificationsService.dispatchDueQueue()
      if (count > 0) this.logger.log(`Fila de envios: ${count} aviso(s) enviado(s).`)
    } catch (error) {
      this.logger.error('Falha ao disparar broadcasts agendados:', error instanceof Error ? error.stack : String(error))
    } finally {
      this.isRunning = false
    }
  }
}
