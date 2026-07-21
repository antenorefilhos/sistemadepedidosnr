import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { Roles } from '../../common/decorators/roles.decorator'
import { PublicApiKeyGuard } from '../../common/guards/public-api-key.guard'
import { RequireApiScope } from '../../common/decorators/require-api-scope.decorator'
import { PublicApiService } from './public-api.service'
import { CreateApiClientDto, CreateWebhookEndpointDto, EmitWebhookEventDto, RunWebhookDeliveriesDto } from './dto/public-api.dto'

@ApiTags('Public API v1')
@Controller('v1')
@UseGuards(PublicApiKeyGuard)
@ApiHeader({ name: 'x-api-key', required: true, description: 'API key no formato clientId.secret' })
export class PublicApiV1Controller {
  constructor(private readonly publicApi: PublicApiService) {}

  @Get('orders')
  @RequireApiScope('orders.read')
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiOperation({ summary: 'Listar pedidos via API publica versionada' })
  @ApiResponse({ status: 200, description: 'Pedidos listados.' })
  listOrders(@Req() req: any, @Query('limit') limit?: string) {
    return this.publicApi.listOrders(req.publicApiClient, limit ? Number(limit) : undefined)
  }

  @Get('orders/:id')
  @RequireApiScope('orders.read')
  @ApiOperation({ summary: 'Consultar pedido via API publica versionada' })
  getOrder(@Req() req: any, @Param('id') id: string) {
    return this.publicApi.getOrder(req.publicApiClient, id)
  }

  @Get('products')
  @RequireApiScope('products.read')
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiOperation({ summary: 'Listar produtos via API publica versionada' })
  listProducts(@Req() req: any, @Query('limit') limit?: string) {
    return this.publicApi.listProducts(req.publicApiClient, limit ? Number(limit) : undefined)
  }

  @Get('stock')
  @RequireApiScope('stock.read')
  @ApiQuery({ name: 'productIds', required: false, type: String, description: 'IDs separados por virgula.' })
  @ApiOperation({ summary: 'Consultar estoque/disponibilidade via API publica versionada' })
  listStock(@Req() req: any, @Query('productIds') productIds?: string) {
    const ids = productIds ? productIds.split(',').map((id) => id.trim()).filter(Boolean) : undefined
    return this.publicApi.listStock(req.publicApiClient, ids)
  }
}

@ApiTags('Public API Portal')
@Controller('integrations/public-api')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@ApiBearerAuth()
export class PublicApiAdminController {
  constructor(private readonly publicApi: PublicApiService) {}

  @Get('clients')
  @ApiOperation({ summary: 'Listar clientes da API publica' })
  listClients() {
    return this.publicApi.listClients()
  }

  @Post('clients')
  @ApiOperation({ summary: 'Criar cliente da API publica com scopes' })
  createClient(@Body() body: CreateApiClientDto) {
    return this.publicApi.createClient(body)
  }

  @Get('webhook-endpoints')
  @ApiOperation({ summary: 'Listar endpoints de webhook' })
  listWebhookEndpoints() {
    return this.publicApi.listWebhookEndpoints()
  }

  @Post('webhook-endpoints')
  @ApiOperation({ summary: 'Criar endpoint de webhook assinado' })
  createWebhookEndpoint(@Body() body: CreateWebhookEndpointDto) {
    return this.publicApi.createWebhookEndpoint(body)
  }

  @Post('webhook-events')
  @ApiOperation({ summary: 'Emitir evento de webhook para endpoints inscritos' })
  emitWebhookEvent(@Body() body: EmitWebhookEventDto) {
    return this.publicApi.emitWebhookEvent(body.eventType, body.payload)
  }

  @Get('webhook-deliveries')
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'endpointId', required: false, type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiOperation({ summary: 'Listar entregas de webhook' })
  listWebhookDeliveries(
    @Query('status') status?: string,
    @Query('endpointId') endpointId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.publicApi.listWebhookDeliveries({ status, endpointId, limit: limit ? Number(limit) : undefined })
  }

  @Post('webhook-deliveries/run')
  @ApiOperation({ summary: 'Executar worker de webhooks sob demanda' })
  runWebhookDeliveries(@Body() body: RunWebhookDeliveriesDto) {
    return this.publicApi.runWebhookDeliveries(body?.limit)
  }

  @Post('webhook-deliveries/:deliveryId/replay')
  @ApiOperation({ summary: 'Reprocessar entrega de webhook falha ou morta' })
  replayWebhookDelivery(@Param('deliveryId') deliveryId: string) {
    return this.publicApi.replayWebhookDelivery(deliveryId)
  }
}
