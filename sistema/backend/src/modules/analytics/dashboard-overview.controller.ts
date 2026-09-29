import { Controller, Get, Query, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Roles } from '../../common/decorators/roles.decorator'
import { RelaxedThrottle } from '../../common/decorators/relaxed-throttle.decorator'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { DashboardOverviewService, type OverviewPeriod } from './dashboard-overview.service'

@ApiTags('Admin Painel')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@RelaxedThrottle()
@Controller('admin/overview')
export class DashboardOverviewController {
  constructor(private readonly overview: DashboardOverviewService) {}

  @Get()
  @ApiOperation({ summary: 'Painel inicial: operacao agora, resultado do periodo, site e produtos' })
  get(@Query('period') period?: string) {
    const safe: OverviewPeriod = period === 'week' || period === 'month' ? period : 'day'
    return this.overview.getOverview(safe)
  }
}
