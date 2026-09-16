import { Module } from '@nestjs/common'
import { ObservabilityController } from './observability.controller'
import { ObservabilityService } from './observability.service'

@Module({
  controllers: [ObservabilityController],
  providers: [ObservabilityService],
  exports: [ObservabilityService],
})
export class ObservabilityModule {}
