import { Module } from '@nestjs/common'
import { IntegrationsModule } from '../integrations/integrations.module'
import { CheckupController } from './checkup.controller'
import { CheckupService } from './checkup.service'

@Module({
  imports: [IntegrationsModule],
  controllers: [CheckupController],
  providers: [CheckupService],
})
export class CheckupModule {}
