import { Body, Controller, Get, Headers, Param, Post, Query, Req, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { TenantAccessGuard } from '../../common/guards/tenant-access.guard'
import { Roles } from '../../common/decorators/roles.decorator'
import { getTenantContext, TenantContextRequest } from '../../common/tenant/tenant-context'
import { MarketplaceService } from './marketplace.service'
import { RelaxedThrottle } from '../../common/decorators/relaxed-throttle.decorator'

// JON-116 (Auditoria 360, High): rotas admin liam tenantId/storeId do
// body/query (o proprio chamador decidia em qual tenant estava operando).
// Agora vem sempre do contexto autenticado (TenantAccessGuard +
// getTenantContext), igual ao padrao ja usado em AdminPromotionsController.
@ApiTags('Marketplace')
@RelaxedThrottle()
@Controller('marketplace')
export class MarketplaceController {
  constructor(private readonly marketplaceService: MarketplaceService) {}

  @UseGuards(JwtAuthGuard, TenantAccessGuard, RolesGuard)
  @Roles('admin')
  @Post('channels')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cria ou atualiza canal de venda multicanal' })
  upsertChannel(@Body() body: any, @Req() req: TenantContextRequest) {
    return this.marketplaceService.upsertSalesChannel(body, getTenantContext(req))
  }

  @UseGuards(JwtAuthGuard, TenantAccessGuard, RolesGuard)
  @Roles('admin')
  @Get('channels')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lista canais de venda e marketplaces' })
  listChannels(@Req() req: TenantContextRequest, @Query('status') status?: string, @Query('type') type?: string) {
    return this.marketplaceService.listSalesChannels({ ...getTenantContext(req), status, type })
  }

  @UseGuards(JwtAuthGuard, TenantAccessGuard, RolesGuard)
  @Roles('admin')
  @Post('channels/:channelId/products')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mapeia produto interno para SKU/produto externo do canal' })
  upsertChannelProduct(@Param('channelId') channelId: string, @Body() body: any, @Req() req: TenantContextRequest) {
    return this.marketplaceService.upsertChannelProduct(channelId, body, getTenantContext(req))
  }

  @UseGuards(JwtAuthGuard, TenantAccessGuard, RolesGuard)
  @Roles('admin')
  @Post('channels/:channelId/price-policy')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Define politica de preco por canal' })
  upsertPricePolicy(@Param('channelId') channelId: string, @Body() body: any, @Req() req: TenantContextRequest) {
    return this.marketplaceService.upsertPricePolicy(channelId, body, getTenantContext(req))
  }

  @UseGuards(JwtAuthGuard, TenantAccessGuard, RolesGuard)
  @Roles('admin')
  @Post('channels/:channelId/stock-policy')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Define politica de estoque por canal' })
  upsertStockPolicy(@Param('channelId') channelId: string, @Body() body: any, @Req() req: TenantContextRequest) {
    return this.marketplaceService.upsertStockPolicy(channelId, body, getTenantContext(req))
  }

  // Publico de proposito: canal externo nao tem JWT nenhum pra provar
  // tenant -- o segredo do canal (JON-115) e a credencial aqui.
  @Post('channels/:channelId/orders')
  @ApiOperation({ summary: 'Recebe pedido externo e consolida no OMS' })
  ingestOrder(@Param('channelId') channelId: string, @Body() body: any, @Headers() headers: Record<string, string | string[] | undefined>) {
    return this.marketplaceService.ingestMarketplaceOrder(channelId, body, headers)
  }

  @UseGuards(JwtAuthGuard, TenantAccessGuard, RolesGuard)
  @Roles('admin')
  @Get('panel')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Painel de dependencias e margem por canal' })
  getPanel(@Req() req: TenantContextRequest) {
    return this.marketplaceService.getMarketplacePanel(getTenantContext(req))
  }
}
