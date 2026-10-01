import { Body, Controller, Delete, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Roles } from '../../common/decorators/roles.decorator'
import { RelaxedThrottle } from '../../common/decorators/relaxed-throttle.decorator'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { getTenantContext, TenantContextRequest } from '../../common/tenant/tenant-context'
import { FraudAdminService } from './fraud-admin.service'
import { FraudService } from './fraud.service'

type AdminRequest = TenantContextRequest & { user?: { id?: string } }

@ApiTags('Admin Painel')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@RelaxedThrottle()
@Controller('admin/fraud')
export class FraudController {
  constructor(
    private readonly admin: FraudAdminService,
    private readonly fraud: FraudService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Antifraude: pedidos de risco, contas ligadas, eventos e bloqueios' })
  overview(@Req() req: AdminRequest, @Query('days') days?: string) {
    return this.admin.overview(getTenantContext(req).tenantId, Math.min(90, Math.max(1, Number(days) || 30)))
  }

  @Post('orders/:id/review')
  @ApiOperation({ summary: 'Marca o pedido de risco como conferido (ligou e confirmou)' })
  review(@Req() req: AdminRequest, @Param('id') id: string) {
    return this.admin.review(getTenantContext(req).tenantId, id, req.user?.id)
  }

  @Post('customers/:id/block')
  @ApiOperation({ summary: 'Bloqueia o cliente e o CPF, WhatsApp, e-mail e aparelhos dele' })
  block(@Req() req: AdminRequest, @Param('id') id: string, @Body() body: { reason?: string }) {
    return this.fraud.setCustomerBlocked(getTenantContext(req).tenantId, id, true, body?.reason, req.user?.id)
  }

  @Delete('customers/:id/block')
  @ApiOperation({ summary: 'Desbloqueia o cliente e os identificadores dele' })
  unblock(@Req() req: AdminRequest, @Param('id') id: string) {
    return this.fraud.setCustomerBlocked(getTenantContext(req).tenantId, id, false, null, req.user?.id)
  }
}
