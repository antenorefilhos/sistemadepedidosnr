import { Module } from '@nestjs/common'
import { PushNotificationService } from './push-notification.service'
import { WhatsAppService } from './whatsapp.service'
import { NotificationService } from './notification.service'
import { NotificationsService } from './notifications.service'
import { NotificationsController } from './notifications.controller'
import { PrismaService } from '../../common/prisma.service'

@Module({
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    PushNotificationService,
    WhatsAppService,
    PrismaService,
    NotificationService,
  ],
  exports: [
    NotificationsService,
    PushNotificationService,
    WhatsAppService,
    NotificationService,
  ],
})
export class NotificationsModule {}
