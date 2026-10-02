import { Module } from '@nestjs/common'
import { NotificationsModule } from '../notifications/notifications.module'
import { PromotionsModule } from '../promotions/promotions.module'
import { NotificationQueueController } from './notification-queue.controller'
import { NotificationQueueService } from './notification-queue.service'

/** Fila de envios (02/10/2026): tela Notificacoes > Fila. Envio em NotificationsService. */
@Module({
  imports: [NotificationsModule, PromotionsModule],
  controllers: [NotificationQueueController],
  providers: [NotificationQueueService],
})
export class NotificationQueueModule {}
