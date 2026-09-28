import { Controller, Post, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Roles } from '../../common/decorators/roles.decorator'
import { RelaxedThrottle } from '../../common/decorators/relaxed-throttle.decorator'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { CheckupService } from './checkup.service'

@ApiTags('Admin Check-up')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@RelaxedThrottle()
@Controller('admin/checkup')
export class CheckupController {
  constructor(private readonly checkup: CheckupService) {}

  @Post('run')
  @ApiOperation({ summary: 'Roda o check-up agora e manda o resumo no Telegram' })
  run() {
    return this.checkup.runAndNotify()
  }
}
