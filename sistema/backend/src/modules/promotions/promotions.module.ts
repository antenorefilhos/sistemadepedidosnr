import { Module } from '@nestjs/common'
import { PromotionsService } from './promotions.service'
import { PromotionsController } from './promotions.controller'
import { PromotionsScheduler } from './promotions.scheduler'
import { PrismaService } from '../../common/prisma.service'
import { IntegrationsModule } from '../integrations/integrations.module'

@Module({
  imports: [IntegrationsModule],
  controllers: [PromotionsController],
  providers: [PromotionsService, PromotionsScheduler, PrismaService],
  exports: [PromotionsService],
})
export class PromotionsModule {}
