import { Module } from '@nestjs/common'
import { PrismaService } from '../../common/prisma.service'
import { TenantAccessGuard } from '../../common/guards/tenant-access.guard'
import { DeliveryModule } from '../delivery/delivery.module'
import { InventoryModule } from '../inventory/inventory.module'
import { OrdersModule } from '../orders/orders.module'
import { PricingModule } from '../pricing/pricing.module'
import { CartController } from './cart.controller'
import { AdminCheckoutController, CheckoutSessionsController } from './checkout.controller'
import { CartService } from './cart.service'
import { CheckoutService } from './checkout.service'
import { AbandonedCartScheduler } from './abandoned-cart.scheduler'
import { NotificationsModule } from '../notifications/notifications.module'

@Module({
  imports: [PricingModule, InventoryModule, DeliveryModule, OrdersModule, NotificationsModule],
  controllers: [CartController, CheckoutSessionsController, AdminCheckoutController],
  providers: [CartService, CheckoutService, PrismaService, TenantAccessGuard, AbandonedCartScheduler],
  exports: [CartService, CheckoutService],
})
export class CheckoutModule {}
