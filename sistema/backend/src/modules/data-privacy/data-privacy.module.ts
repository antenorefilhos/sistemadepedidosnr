import { Module } from '@nestjs/common'
import { PrismaService } from '../../common/prisma.service'
import { AuditLogModule } from '../audit-log/audit-log.module'
import { DataPrivacyController } from './data-privacy.controller'
import { DataPrivacyService } from './data-privacy.service'

@Module({
  imports: [AuditLogModule],
  controllers: [DataPrivacyController],
  providers: [PrismaService, DataPrivacyService],
  exports: [DataPrivacyService],
})
export class DataPrivacyModule {}
