import { Module } from '@nestjs/common'
import { PushNotificationService } from './push-notification.service'
import { WhatsAppService } from './whatsapp.service'
import { NotificationService } from './notification.service'
import { NotificationsService } from './notifications.service'
import { NotificationsController } from './notifications.controller'
import { EmailService } from './email.service'
import { OfferPushService } from './offer-push.service'
import { ScheduledNotificationScheduler } from './scheduled-notification.scheduler'
import { IntegrationModulesService } from '../integrations/integration-modules.service'

@Module({
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    PushNotificationService,
    WhatsAppService,
    NotificationService,
    EmailService,
    OfferPushService,
    ScheduledNotificationScheduler,
    IntegrationModulesService,
  ],
  exports: [
    NotificationsService,
    PushNotificationService,
    WhatsAppService,
    NotificationService,
    EmailService,
    OfferPushService,
  ],
})
export class NotificationsModule {}
