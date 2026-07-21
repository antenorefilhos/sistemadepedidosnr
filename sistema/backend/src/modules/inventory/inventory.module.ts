import { Module } from '@nestjs/common'
import { PrismaService } from '../../common/prisma.service'
import { PermissionGuard } from '../../common/guards/permission.guard'
import { TenantAccessGuard } from '../../common/guards/tenant-access.guard'
import { AdminStockController, AvailabilityController, StockReservationsController } from './inventory.controller'
import { InventoryService } from './inventory.service'
import { PublicApiModule } from '../public-api/public-api.module'

@Module({
  imports: [PublicApiModule],
  controllers: [AvailabilityController, StockReservationsController, AdminStockController],
  providers: [InventoryService, PrismaService, TenantAccessGuard, PermissionGuard],
  exports: [InventoryService],
})
export class InventoryModule {}
