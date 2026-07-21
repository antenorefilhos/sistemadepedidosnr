import { Module } from '@nestjs/common'
import { PrismaService } from '../../common/prisma.service'
import { PermissionGuard } from '../../common/guards/permission.guard'
import { TenantAccessGuard } from '../../common/guards/tenant-access.guard'
import { AdminPriceListsController, AdminPromotionsController, PricingController } from './pricing.controller'
import { PricingService, PromotionEngineService } from './pricing.service'

@Module({
  controllers: [PricingController, AdminPriceListsController, AdminPromotionsController],
  providers: [PricingService, PromotionEngineService, PrismaService, TenantAccessGuard, PermissionGuard],
  exports: [PricingService, PromotionEngineService],
})
export class PricingModule {}
