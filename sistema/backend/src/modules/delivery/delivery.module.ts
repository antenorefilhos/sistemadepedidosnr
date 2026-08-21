import { Module } from '@nestjs/common'
import { DeliveryService } from './delivery.service'
import { IbgeAddressService } from './ibge-address.service'
import { AdminFulfillmentController, DeliveryController } from './delivery.controller'
import { DriverController } from './driver.controller'
import { PrismaService } from '../../common/prisma.service'
import { TenantAccessGuard } from '../../common/guards/tenant-access.guard'
import { NotificationsModule } from '../notifications/notifications.module'

@Module({
  imports: [NotificationsModule],
  controllers: [DeliveryController, AdminFulfillmentController, DriverController],
  providers: [DeliveryService, IbgeAddressService, PrismaService, TenantAccessGuard],
  exports: [DeliveryService, IbgeAddressService],
})
export class DeliveryModule {}
