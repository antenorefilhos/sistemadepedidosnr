import { Module } from '@nestjs/common'
import { PrismaService } from '../../common/prisma.service'
import { RecommendationsController } from './recommendations.controller'
import { RecommendationsService } from './recommendations.service'

@Module({
  controllers: [RecommendationsController],
  providers: [PrismaService, RecommendationsService],
  exports: [RecommendationsService],
})
export class RecommendationsModule {}
