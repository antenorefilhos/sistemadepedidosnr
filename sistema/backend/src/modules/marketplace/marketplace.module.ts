import { Module } from '@nestjs/common'
import { PrismaService } from '../../common/prisma.service'
import { OrdersModule } from '../orders/orders.module'
import { MarketplaceController } from './marketplace.controller'
import { MarketplaceService } from './marketplace.service'

@Module({
  imports: [OrdersModule],
  controllers: [MarketplaceController],
  providers: [MarketplaceService, PrismaService],
  exports: [MarketplaceService],
})
export class MarketplaceModule {}
