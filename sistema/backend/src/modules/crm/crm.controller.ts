import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { Roles } from '../../common/decorators/roles.decorator'
import { CrmService } from './crm.service'
import { CreateCampaignDto, CreateShoppingListDto, LoyaltyMutationDto, RefreshSegmentsDto, ReorderFromOrderDto, UpsertCustomerConsentDto, UpsertCustomerProfileDto } from './dto/crm.dto'

@ApiTags('CRM')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('crm')
export class CrmController {
  constructor(private readonly crm: CrmService) {}

  @Roles('admin')
  @Get('customers/:customerId/relationship')
  @ApiOperation({ summary: 'Visao CRM do cliente com perfil, consentimentos, fidelidade, listas e recompra' })
  getRelationship(@Param('customerId') customerId: string) {
    return this.crm.getCustomerRelationship(customerId)
  }

  @Roles('admin')
  @Post('customers/:customerId/profile')
  @ApiOperation({ summary: 'Criar ou atualizar perfil CRM do cliente' })
  upsertProfile(@Param('customerId') customerId: string, @Body() body: UpsertCustomerProfileDto) {
    return this.crm.upsertProfile(customerId, body)
  }

  @Post('customers/:customerId/consents')
  @ApiOperation({ summary: 'Registrar consentimento ou opt-out do cliente' })
  upsertConsent(@Param('customerId') customerId: string, @Body() body: UpsertCustomerConsentDto, @Req() req: any) {
    return this.crm.upsertConsent(customerId, body, {
      ip: req.ip,
      userAgent: req.headers?.['user-agent'],
    })
  }

  @Roles('admin')
  @Post('segments/refresh')
  @ApiOperation({ summary: 'Atualizar segmentos automaticos de CRM' })
  refreshSegments(@Body() body: RefreshSegmentsDto) {
    return this.crm.refreshSegments(body)
  }

  @Roles('admin')
  @Post('customers/:customerId/loyalty/credit')
  @ApiOperation({ summary: 'Creditar pontos ou cashback no ledger de fidelidade' })
  creditLoyalty(@Param('customerId') customerId: string, @Body() body: LoyaltyMutationDto) {
    return this.crm.mutateLoyalty(customerId, 'CREDIT', body)
  }

  @Roles('admin')
  @Post('customers/:customerId/loyalty/redeem')
  @ApiOperation({ summary: 'Resgatar pontos ou cashback com auditoria de saldo' })
  redeemLoyalty(@Param('customerId') customerId: string, @Body() body: LoyaltyMutationDto) {
    return this.crm.mutateLoyalty(customerId, 'REDEEM', {
      ...body,
      points: body.points ? -Math.abs(Number(body.points)) : 0,
      cashback: body.cashback ? -Math.abs(Number(body.cashback)) : 0,
    })
  }

  @Get('customers/:customerId/loyalty')
  @ApiOperation({ summary: 'Consultar saldo e extrato de fidelidade' })
  getLoyalty(@Param('customerId') customerId: string) {
    return this.crm.getLoyalty(customerId)
  }

  @Roles('admin')
  @Post('campaigns')
  @ApiOperation({ summary: 'Criar campanha CRM transacional ou promocional' })
  createCampaign(@Body() body: CreateCampaignDto) {
    return this.crm.createCampaign(body)
  }

  @Roles('admin')
  @Post('campaigns/:campaignId/dispatch')
  @ApiOperation({ summary: 'Gerar entregas de campanha respeitando consentimento' })
  dispatchCampaign(@Param('campaignId') campaignId: string) {
    return this.crm.dispatchCampaign(campaignId)
  }

  @Post('customers/:customerId/shopping-lists')
  @ApiOperation({ summary: 'Criar lista de compra do cliente' })
  createShoppingList(@Param('customerId') customerId: string, @Body() body: CreateShoppingListDto) {
    return this.crm.createShoppingList(customerId, body)
  }

  @Post('customers/:customerId/shopping-lists/from-order')
  @ApiOperation({ summary: 'Criar lista de recompra a partir de pedido anterior' })
  createShoppingListFromOrder(@Param('customerId') customerId: string, @Body() body: ReorderFromOrderDto) {
    return this.crm.createShoppingListFromOrder(customerId, body)
  }

  @Get('customers/:customerId/reorder/:orderId')
  @ApiOperation({ summary: 'Gerar payload de recompra de pedido anterior' })
  getReorderPayload(@Param('customerId') customerId: string, @Param('orderId') orderId: string) {
    return this.crm.getReorderPayload(customerId, orderId)
  }
}
