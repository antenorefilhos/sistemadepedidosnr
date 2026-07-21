import { Body, Controller, Get, Headers, Param, Post, Query, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { Roles } from '../../common/decorators/roles.decorator'
import { MarketplaceService } from './marketplace.service'

@ApiTags('Marketplace')
@Controller('marketplace')
export class MarketplaceController {
  constructor(private readonly marketplaceService: MarketplaceService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post('channels')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cria ou atualiza canal de venda multicanal' })
  upsertChannel(@Body() body: any) {
    return this.marketplaceService.upsertSalesChannel(body)
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get('channels')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lista canais de venda e marketplaces' })
  listChannels(@Query('tenantId') tenantId?: string, @Query('storeId') storeId?: string, @Query('status') status?: string, @Query('type') type?: string) {
    return this.marketplaceService.listSalesChannels({ tenantId, storeId, status, type })
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post('channels/:channelId/products')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mapeia produto interno para SKU/produto externo do canal' })
  upsertChannelProduct(@Param('channelId') channelId: string, @Body() body: any) {
    return this.marketplaceService.upsertChannelProduct(channelId, body)
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post('channels/:channelId/price-policy')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Define politica de preco por canal' })
  upsertPricePolicy(@Param('channelId') channelId: string, @Body() body: any) {
    return this.marketplaceService.upsertPricePolicy(channelId, body)
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post('channels/:channelId/stock-policy')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Define politica de estoque por canal' })
  upsertStockPolicy(@Param('channelId') channelId: string, @Body() body: any) {
    return this.marketplaceService.upsertStockPolicy(channelId, body)
  }

  @Post('channels/:channelId/orders')
  @ApiOperation({ summary: 'Recebe pedido externo e consolida no OMS' })
  ingestOrder(@Param('channelId') channelId: string, @Body() body: any, @Headers() headers: Record<string, string | string[] | undefined>) {
    return this.marketplaceService.ingestMarketplaceOrder(channelId, body, headers)
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get('panel')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Painel de dependencias e margem por canal' })
  getPanel(@Query('tenantId') tenantId?: string, @Query('storeId') storeId?: string) {
    return this.marketplaceService.getMarketplacePanel({ tenantId, storeId })
  }
}
