import { Module } from '@nestjs/common'
import { PrismaService } from '../../common/prisma.service'
import { TenantAccessGuard } from '../../common/guards/tenant-access.guard'
import { NotificationsModule } from '../notifications/notifications.module'
import { AdminPickingController } from './picking.controller'
import { PickerController } from './picker.controller'
import { PickingService } from './picking.service'

@Module({
  imports: [NotificationsModule],
  controllers: [AdminPickingController, PickerController],
  providers: [PickingService, PrismaService, TenantAccessGuard],
  exports: [PickingService],
})
export class PickingModule {}
