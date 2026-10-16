import { Controller, Get, Query, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Roles } from '../../common/decorators/roles.decorator'
import { RelaxedThrottle } from '../../common/decorators/relaxed-throttle.decorator'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { validateDateRangeParams } from '../../common/date-range'
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
  @ApiOperation({ summary: 'Painel inicial: operacao agora, resultado do periodo, site e produtos. period=custom com from/to (AAAA-MM-DD) pra qualquer intervalo.' })
  get(@Query('period') period?: string, @Query('from') from?: string, @Query('to') to?: string) {
    if (period === 'custom') {
      const range = validateDateRangeParams(from, to)
      return this.overview.getOverview(range)
    }
    const safe: OverviewPeriod = period === 'week' || period === 'month' ? period : 'day'
    return this.overview.getOverview({ period: safe })
  }
}
