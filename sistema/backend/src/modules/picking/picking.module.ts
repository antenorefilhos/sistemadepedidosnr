import { Module } from '@nestjs/common'
import { PrismaService } from '../../common/prisma.service'
import { TenantAccessGuard } from '../../common/guards/tenant-access.guard'
import { AdminPickingController } from './picking.controller'
import { PickingService } from './picking.service'

@Module({
  controllers: [AdminPickingController],
  providers: [PickingService, PrismaService, TenantAccessGuard],
  exports: [PickingService],
})
export class PickingModule {}
