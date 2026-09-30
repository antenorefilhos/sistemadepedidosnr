import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Roles } from '../../common/decorators/roles.decorator'
import { RelaxedThrottle } from '../../common/decorators/relaxed-throttle.decorator'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { getTenantContext, type TenantContextRequest } from '../../common/tenant/tenant-context'
import { PaymentsOverviewService } from './payments-overview.service'

@ApiTags('Admin Painel')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@RelaxedThrottle()
@Controller('admin/payments')
export class PaymentsOverviewController {
  constructor(private readonly payments: PaymentsOverviewService) {}

  @Get()
  @ApiOperation({ summary: 'O que o cliente aprovou no site x o que o caixa cobrou, por pedido e por forma de pagamento' })
  overview(@Query('days') days: string, @Req() req: TenantContextRequest) {
    const d = [7, 30, 90].includes(Number(days)) ? Number(days) : 30
    return this.payments.overview(getTenantContext(req).tenantId, d)
  }
}
