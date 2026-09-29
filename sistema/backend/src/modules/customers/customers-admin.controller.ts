import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Roles } from '../../common/decorators/roles.decorator'
import { RelaxedThrottle } from '../../common/decorators/relaxed-throttle.decorator'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { getTenantContext, type TenantContextRequest } from '../../common/tenant/tenant-context'
import { CustomersAdminService } from './customers-admin.service'

@ApiTags('Admin Painel')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@RelaxedThrottle()
@Controller('admin/customers')
export class CustomersAdminController {
  constructor(private readonly customers: CustomersAdminService) {}

  @Get()
  @ApiOperation({ summary: 'Clientes com pedidos validos, gasto, ultimo pedido e avisos' })
  overview(@Req() req: TenantContextRequest) {
    return this.customers.overview(getTenantContext(req).tenantId)
  }

  @Get(':id')
  @ApiOperation({ summary: 'Resumo do cliente: pedidos, mais comprados, enderecos e conta' })
  detail(@Param('id') id: string, @Req() req: TenantContextRequest) {
    return this.customers.detail(id, getTenantContext(req).tenantId)
  }
}
