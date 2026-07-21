import { Module, Global } from '@nestjs/common';
import { AuditLogService } from './audit-log.service';
import { PrismaService } from '../../common/prisma.service';

@Global()
@Module({
  providers: [AuditLogService, PrismaService],
  exports: [AuditLogService],
})
export class AuditLogModule {}
