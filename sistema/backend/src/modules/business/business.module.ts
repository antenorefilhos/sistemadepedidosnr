import { Module } from '@nestjs/common'
import { PrismaService } from '../../common/prisma.service'
import { TenantAccessGuard } from '../../common/guards/tenant-access.guard'
import { OrdersModule } from '../orders/orders.module'
import { IntegrationsModule } from '../integrations/integrations.module'
import { BusinessController, AdminBusinessAccountsController } from './business.controller'
import { BusinessService } from './business.service'

@Module({
  imports: [OrdersModule, IntegrationsModule],
  controllers: [BusinessController, AdminBusinessAccountsController],
  providers: [BusinessService, PrismaService, TenantAccessGuard],
  exports: [BusinessService],
})
export class BusinessModule {}
