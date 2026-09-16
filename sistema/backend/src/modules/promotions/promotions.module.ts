import { Module } from '@nestjs/common'
import { PromotionsService } from './promotions.service'
import { PromotionsController } from './promotions.controller'
import { PromotionsScheduler } from './promotions.scheduler'
import { IntegrationsModule } from '../integrations/integrations.module'
import { NotificationsModule } from '../notifications/notifications.module'

@Module({
  imports: [IntegrationsModule, NotificationsModule],
  controllers: [PromotionsController],
  providers: [PromotionsService, PromotionsScheduler],
  exports: [PromotionsService],
})
export class PromotionsModule {}
