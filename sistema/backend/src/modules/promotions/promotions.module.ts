import { Module } from '@nestjs/common'
import { PromotionsService } from './promotions.service'
import { PromotionsController } from './promotions.controller'
import { PromotionsScheduler } from './promotions.scheduler'
import { IntegrationsModule } from '../integrations/integrations.module'
import { ProductsModule } from '../products/products.module'

@Module({
  imports: [IntegrationsModule, ProductsModule],
  controllers: [PromotionsController],
  providers: [PromotionsService, PromotionsScheduler],
  exports: [PromotionsService],
})
export class PromotionsModule {}
