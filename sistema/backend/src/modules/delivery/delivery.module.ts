import { Module } from '@nestjs/common'
import { DeliveryService } from './delivery.service'
import { AdminFulfillmentController, DeliveryController } from './delivery.controller'
import { PrismaService } from '../../common/prisma.service'
import { TenantAccessGuard } from '../../common/guards/tenant-access.guard'

@Module({
  controllers: [DeliveryController, AdminFulfillmentController],
  providers: [DeliveryService, PrismaService, TenantAccessGuard],
  exports: [DeliveryService],
})
export class DeliveryModule {}
