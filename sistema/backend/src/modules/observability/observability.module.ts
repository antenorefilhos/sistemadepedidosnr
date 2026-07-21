import { Module } from '@nestjs/common'
import { PrismaService } from '../../common/prisma.service'
import { ObservabilityController } from './observability.controller'
import { ObservabilityService } from './observability.service'

@Module({
  controllers: [ObservabilityController],
  providers: [ObservabilityService, PrismaService],
  exports: [ObservabilityService],
})
export class ObservabilityModule {}
