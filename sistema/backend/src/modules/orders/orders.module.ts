import { Module } from '@nestjs/common'
import { OrdersService } from './orders.service'
import { AdminOrdersController, OrdersController } from './orders.controller'
import { NotificationsModule } from '../../modules/notifications/notifications.module'
import { IntegrationsModule } from '../integrations/integrations.module'
import { TenantAccessGuard } from '../../common/guards/tenant-access.guard'
import { InventoryModule } from '../inventory/inventory.module'
import { PricingModule } from '../pricing/pricing.module'
import { PublicApiModule } from '../public-api/public-api.module'
import { BrandModule } from '../brand/brand.module'

@Module({
  imports: [NotificationsModule, IntegrationsModule, InventoryModule, PricingModule, PublicApiModule, BrandModule],
  controllers: [OrdersController, AdminOrdersController],
  providers: [OrdersService, TenantAccessGuard],
  exports: [OrdersService],
})
export class OrdersModule {}
