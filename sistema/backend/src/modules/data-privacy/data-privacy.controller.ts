import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger'
import { Roles } from '../../common/decorators/roles.decorator'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { getTenantContext, TenantContextRequest } from '../../common/tenant/tenant-context'
import { DataPrivacyService } from './data-privacy.service'

@ApiTags('Data Privacy')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('data-privacy')
export class DataPrivacyController {
  constructor(private readonly dataPrivacy: DataPrivacyService) {}

  @Post('customers/:customerId/consents')
  @ApiOperation({ summary: 'Registrar pacote LGPD de consentimentos do cliente' })
  upsertConsentBundle(@Param('customerId') customerId: string, @Body() body: any, @Req() req: TenantContextRequest & any) {
    return this.dataPrivacy.upsertConsentBundle(customerId, body, this.context(req))
  }

  @Get('customers/:customerId/export')
  @ApiOperation({ summary: 'Executar exportacao de dados do titular LGPD' })
  exportCustomerData(@Param('customerId') customerId: string, @Req() req: TenantContextRequest & any) {
    return this.dataPrivacy.exportCustomerData(customerId, this.context(req))
  }

  @Post('customers/:customerId/anonymize')
  @ApiOperation({ summary: 'Executar anonimizacao LGPD quando permitida' })
  anonymizeCustomer(@Param('customerId') customerId: string, @Body() body: any, @Req() req: TenantContextRequest & any) {
    return this.dataPrivacy.anonymizeCustomer(customerId, body, this.context(req))
  }

  @Get('retention-policy')
  @ApiOperation({ summary: 'Consultar politica operacional de retencao LGPD' })
  getRetentionPolicy() {
    return this.dataPrivacy.getRetentionPolicy()
  }

  @Get('requests')
  @ApiOperation({ summary: 'Listar solicitacoes LGPD executadas ou pendentes' })
  @ApiQuery({ name: 'customerId', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'type', required: false })
  listRequests(
    @Query('customerId') customerId: string | undefined,
    @Query('status') status: string | undefined,
    @Query('type') type: string | undefined,
    @Req() req: TenantContextRequest & any,
  ) {
    return this.dataPrivacy.listRequests({ ...this.context(req), customerId, status, type })
  }

  private context(req: TenantContextRequest & any) {
    return {
      ...getTenantContext(req),
      actorId: req.user?.id,
      ip: req.ip,
      userAgent: req.headers?.['user-agent'],
    }
  }
}
