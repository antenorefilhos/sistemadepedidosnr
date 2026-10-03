import { Module } from '@nestjs/common'
import { TenantAccessGuard } from '../../common/guards/tenant-access.guard'
import { NotificationsModule } from '../notifications/notifications.module'
import { IntegrationsModule } from '../integrations/integrations.module'
import { OrdersModule } from '../orders/orders.module'
import { AdminPickingController } from './picking.controller'
import { PickerController } from './picker.controller'
import { PickingService } from './picking.service'

@Module({
  imports: [NotificationsModule, IntegrationsModule, OrdersModule],
  controllers: [AdminPickingController, PickerController],
  providers: [PickingService, TenantAccessGuard],
  exports: [PickingService],
})
export class PickingModule {}
