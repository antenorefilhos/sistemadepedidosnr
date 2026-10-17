import { Module } from '@nestjs/common'
import { IntegrationsModule } from '../integrations/integrations.module'
import { NotificationsModule } from '../notifications/notifications.module'
import { CheckupController } from './checkup.controller'
import { CheckupService } from './checkup.service'

@Module({
  imports: [IntegrationsModule, NotificationsModule],
  controllers: [CheckupController],
  providers: [CheckupService],
})
export class CheckupModule {}
