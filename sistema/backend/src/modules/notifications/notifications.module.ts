import { Module } from '@nestjs/common'
import { PushNotificationService } from './push-notification.service'
import { WhatsAppService } from './whatsapp.service'
import { NotificationService } from './notification.service'
import { NotificationsService } from './notifications.service'
import { NotificationsController } from './notifications.controller'
import { EmailService } from './email.service'
import { AiNotificationService } from './ai-notification.service'
import { AiNotificationScheduler } from './ai-notification.scheduler'
import { PrismaService } from '../../common/prisma.service'

@Module({
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    PushNotificationService,
    WhatsAppService,
    PrismaService,
    NotificationService,
    EmailService,
    AiNotificationService,
    AiNotificationScheduler,
  ],
  exports: [
    NotificationsService,
    PushNotificationService,
    WhatsAppService,
    NotificationService,
    EmailService,
    AiNotificationService,
  ],
})
export class NotificationsModule {}
