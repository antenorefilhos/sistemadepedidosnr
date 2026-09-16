import { Module } from '@nestjs/common'
import { AuditLogModule } from '../audit-log/audit-log.module'
import { DataPrivacyController } from './data-privacy.controller'
import { DataPrivacyService } from './data-privacy.service'

@Module({
  imports: [AuditLogModule],
  controllers: [DataPrivacyController],
  providers: [DataPrivacyService],
  exports: [DataPrivacyService],
})
export class DataPrivacyModule {}
