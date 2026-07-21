import { Module } from '@nestjs/common'
import { PrismaService } from '../../common/prisma.service'
import { CrmController } from './crm.controller'
import { CrmService } from './crm.service'

@Module({
  controllers: [CrmController],
  providers: [CrmService, PrismaService],
  exports: [CrmService],
})
export class CrmModule {}
