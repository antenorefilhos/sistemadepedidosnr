import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common'
import { DeliveryService } from './delivery.service'
import { IbgeAddressService } from './ibge-address.service'
import { CreateDeliveryZoneDto, UpdateDeliveryZoneDto } from './dto/delivery-zone.dto'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { TenantAccessGuard } from '../../common/guards/tenant-access.guard'
import { Roles } from '../../common/decorators/roles.decorator'
import { getTenantContext, TenantContextRequest } from '../../common/tenant/tenant-context'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { RelaxedThrottle } from '../../common/decorators/relaxed-throttle.decorator'
import {
  AddDeliveryStopDto,
  CreateDeliveryAreaDto,
  CreateDeliveryRouteDto,
  CreateDriverDto,
  CreateFulfillmentSlotDto,
  UpdateDeliveryAreaDto,
  UpdateDeliveryStopStatusDto,
  UpdateFulfillmentSlotDto,
} from './dto/fulfillment.dto'

@ApiTags('delivery')
@RelaxedThrottle()
@Controller('delivery')
export class DeliveryController {
  constructor(
    private readonly deliveryService: DeliveryService,
    private readonly ibgeAddressService: IbgeAddressService,
  ) {}

  // ── Público: base local do IBGE (CNEFE 2022) -- geocodificacao reversa,
  // consulta por CEP e autocomplete de logradouro sem depender de API paga. ──
  @Post('ibge/reverse')
  @ApiOperation({ summary: 'Geocodificacao reversa local via CNEFE (IBGE) -- endereco mais proximo da coordenada' })
  async ibgeReverse(@Body() body: { latitude?: number; longitude?: number; radiusMeters?: number }) {
    const lat = Number(body?.latitude)
    const lng = Number(body?.longitude)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
    return this.ibgeAddressService.findNearest(lat, lng, body?.radiusMeters ? Number(body.radiusMeters) : undefined)
  }

  @Get('ibge/by-cep/:cep')
  @ApiOperation({ summary: 'Logradouros/servidoes cadastrados no CNEFE (IBGE) pra um CEP' })
  async ibgeByCep(@Param('cep') cep: string) {
    return this.ibgeAddressService.findByCep(cep)
  }

  @Get('ibge/search')
  @ApiOperation({ summary: 'Autocomplete de logradouro via CNEFE (IBGE)' })
  async ibgeSearch(@Query('q') q?: string, @Query('bairro') bairro?: string) {
    return this.ibgeAddressService.searchLogradouros(q || '', bairro)
  }

  // ── Público: calcular frete por CEP ──────────────────────────────────
  @Get('calculate')
  @ApiOperation({ summary: 'Calcular taxa de entrega por CEP ou geolocalização' })
  calculate(
    @Query('cep') cep?: string,
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
    @Query('subtotal') subtotal?: string,
    @Query('locality') locality?: string,
    @Query('deliveryPointCode') deliveryPointCode?: string,
  ) {
    return this.deliveryService.calculate({
      cep,
      lat: lat ? Number(lat) : undefined,
      lng: lng ? Number(lng) : undefined,
      subtotal: subtotal ? Number(subtotal) : undefined,
      locality,
      deliveryPointCode,
    })
  }

  @Get('slots')
  @ApiOperation({ summary: 'Listar janelas publicas de entrega ou retirada' })
  listPublicSlots(
    @Query('type') type?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.deliveryService.listSlotOccupancy(undefined, { type, from, to, status: 'ACTIVE' })
  }

  // ── Admin: CRUD de zonas ─────────────────────────────────────────────
  @Get('zones')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  listZones() {
    return this.deliveryService.listZones()
  }

  @Post('zones')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  createZone(@Body() dto: CreateDeliveryZoneDto) {
    return this.deliveryService.createZone(dto)
  }

  @Patch('zones/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  updateZone(@Param('id') id: string, @Body() dto: UpdateDeliveryZoneDto) {
    return this.deliveryService.updateZone(id, dto)
  }

  @Delete('zones/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteZone(@Param('id') id: string) {
    return this.deliveryService.deleteZone(id)
  }

  @Post('zones/test')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Testar CEP/coordenadas contra zonas cadastradas' })
  testZone(@Body() body: { cep?: string; lat?: number; lng?: number; subtotal?: number }) {
    return this.deliveryService.testZone(body || {})
  }

  @Post('zones/overlap-check')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Detectar sobreposicao de zonas' })
  checkZoneOverlap(@Body() body: { id?: string; type: string; cepStart?: string | null; cepEnd?: string | null; polygonGeoJSON?: string | null }) {
    return this.deliveryService.checkZoneOverlap(body)
  }

  @Post('zones/bulk-import')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Importar zonas em lote (array de CEP ranges)' })
  bulkImportZones(@Body() body: { zones: Array<CreateDeliveryZoneDto> }) {
    return this.deliveryService.bulkImportZones(body?.zones || [])
  }
}

@ApiTags('Admin Fulfillment')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantAccessGuard, RolesGuard)
@Roles('admin')
@RelaxedThrottle()
@Controller('admin/fulfillment')
export class AdminFulfillmentController {
  constructor(private readonly deliveryService: DeliveryService) {}

  @Get('areas')
  @ApiOperation({ summary: 'Listar areas de entrega por loja' })
  listAreas(@Req() req: TenantContextRequest) {
    return this.deliveryService.listAreas(getTenantContext(req))
  }

  @Post('areas')
  @ApiOperation({ summary: 'Criar area de entrega com regra server-side' })
  createArea(@Req() req: TenantContextRequest, @Body() dto: CreateDeliveryAreaDto) {
    return this.deliveryService.createArea(getTenantContext(req), dto)
  }

  @Patch('areas/:id')
  @ApiOperation({ summary: 'Atualizar area de entrega' })
  updateArea(@Param('id') id: string, @Req() req: TenantContextRequest, @Body() dto: UpdateDeliveryAreaDto) {
    return this.deliveryService.updateArea(id, getTenantContext(req), dto)
  }

  @Delete('areas/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remover area de entrega' })
  deleteArea(@Param('id') id: string, @Req() req: TenantContextRequest) {
    return this.deliveryService.deleteArea(id, getTenantContext(req))
  }

  @Get('slots')
  @ApiOperation({ summary: 'Listar janelas e ocupacao' })
  listSlots(
    @Req() req: TenantContextRequest,
    @Query('type') type?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('status') status?: string,
  ) {
    return this.deliveryService.listSlotOccupancy(getTenantContext(req), { type, from, to, status })
  }

  @Post('slots')
  @ApiOperation({ summary: 'Criar janela de entrega ou retirada' })
  createSlot(@Req() req: TenantContextRequest, @Body() dto: CreateFulfillmentSlotDto) {
    return this.deliveryService.createSlot(getTenantContext(req), dto)
  }

  @Patch('slots/:id')
  @ApiOperation({ summary: 'Atualizar janela de entrega ou retirada' })
  updateSlot(@Param('id') id: string, @Req() req: TenantContextRequest, @Body() dto: UpdateFulfillmentSlotDto) {
    return this.deliveryService.updateSlot(id, getTenantContext(req), dto)
  }

  @Delete('slots/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remover janela sem reservas' })
  deleteSlot(@Param('id') id: string, @Req() req: TenantContextRequest) {
    return this.deliveryService.deleteSlot(id, getTenantContext(req))
  }

  @Get('drivers')
  @ApiOperation({ summary: 'Listar motoristas' })
  listDrivers(@Req() req: TenantContextRequest) {
    return this.deliveryService.listDrivers(getTenantContext(req))
  }

  @Post('drivers')
  @ApiOperation({ summary: 'Criar motorista' })
  createDriver(@Req() req: TenantContextRequest, @Body() dto: CreateDriverDto) {
    return this.deliveryService.createDriver(getTenantContext(req), dto)
  }

  @Get('routes')
  @ApiOperation({ summary: 'Listar rotas de entrega' })
  listRoutes(@Req() req: TenantContextRequest, @Query('status') status?: string) {
    return this.deliveryService.listRoutes(getTenantContext(req), { status })
  }

  @Get('drivers/performance')
  @ApiOperation({ summary: 'Desempenho de entregadores por periodo' })
  getDriverPerformance(@Req() req: TenantContextRequest, @Query('from') from?: string, @Query('to') to?: string) {
    return this.deliveryService.getDriverPerformance(getTenantContext(req), { from, to })
  }

  @Post('routes')
  @ApiOperation({ summary: 'Criar rota manual' })
  createRoute(@Req() req: TenantContextRequest, @Body() dto: CreateDeliveryRouteDto) {
    return this.deliveryService.createRoute(getTenantContext(req), dto, this.actorFromRequest(req))
  }

  @Post('routes/:id/stops')
  @ApiOperation({ summary: 'Adicionar parada na rota' })
  addStop(@Param('id') id: string, @Req() req: TenantContextRequest, @Body() dto: AddDeliveryStopDto) {
    return this.deliveryService.addStop(id, getTenantContext(req), dto, this.actorFromRequest(req))
  }

  @Post('routes/:id/start')
  @ApiOperation({ summary: 'Registrar saida para entrega' })
  startRoute(@Param('id') id: string, @Req() req: TenantContextRequest) {
    return this.deliveryService.startRoute(id, getTenantContext(req), this.actorFromRequest(req))
  }

  @Post('routes/:id/stops/:stopId/status')
  @ApiOperation({ summary: 'Atualizar status de parada' })
  updateStopStatus(
    @Param('id') id: string,
    @Param('stopId') stopId: string,
    @Req() req: TenantContextRequest,
    @Body() dto: UpdateDeliveryStopStatusDto,
  ) {
    return this.deliveryService.updateStopStatus(id, stopId, getTenantContext(req), dto, this.actorFromRequest(req))
  }

  @Post('routes/:id/complete')
  @ApiOperation({ summary: 'Concluir rota' })
  completeRoute(@Param('id') id: string, @Req() req: TenantContextRequest) {
    return this.deliveryService.completeRoute(id, getTenantContext(req), this.actorFromRequest(req))
  }

  private actorFromRequest(req: TenantContextRequest) {
    return {
      actorType: 'ADMIN',
      actorId: req.user?.id,
    }
  }
}
