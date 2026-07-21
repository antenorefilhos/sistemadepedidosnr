import { Controller, Get, Post, Body, Param, Put, Delete, Query, UseGuards, Req, ForbiddenException } from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery, ApiBearerAuth } from '@nestjs/swagger'
import { OrdersService } from './orders.service'
import { CreateOrderResult } from './orders.service'
import { CreateOrderDto } from './dto/create-order.dto'
import { UpdateOrderDto } from './dto/update-order.dto'
import { AddOrderEventDto, CancelOrderDto, CancelOrderItemDto, SubstituteOrderItemDto } from './dto/oms-order.dto'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { TenantAccessGuard } from '../../common/guards/tenant-access.guard'
import { Roles } from '../../common/decorators/roles.decorator'
import { assertCustomerOwnership, isAdminUser } from '../../common/security/customer-ownership'
import { getTenantContext, TenantContextRequest } from '../../common/tenant/tenant-context'

@ApiTags('Orders')
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @UseGuards(JwtAuthGuard, TenantAccessGuard)
  @Get()
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Listar pedidos',
    description: 'Retorna lista de pedidos, opcionalmente filtrada por cliente.',
  })
  @ApiQuery({ name: 'customerId', required: false, type: String, description: 'ID do cliente para filtrar' })
  @ApiResponse({
    status: 200,
    description: 'Lista de pedidos',
    schema: {
      example: [
        {
          id: '1',
          customerId: '1',
          total: 500.0,
          status: 'pending',
          createdAt: '2026-04-18',
        },
      ],
    },
  })
  async findAll(
    @Query('customerId') customerId: string | undefined,
    @Req() req: TenantContextRequest,
  ) {
    const role = String(req.user?.role || '').toLowerCase()
    const requesterId = String(req.user?.id || '')

    if (role === 'admin') {
      return this.ordersService.findAll(customerId, getTenantContext(req))
    }

    if (!requesterId) {
      throw new ForbiddenException('Usuario autenticado sem identificacao')
    }

    if (customerId && customerId !== requesterId) {
      throw new ForbiddenException('Acesso negado para pedidos de outro cliente')
    }

    return this.ordersService.findAll(requesterId, getTenantContext(req))
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get('analytics/sales')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Análise de vendas',
    description: 'Retorna vendas agregadas por período (dia, semana, mês).',
  })
  @ApiQuery({ name: 'period', required: false, type: String, enum: ['day', 'week', 'month'], description: 'Período de agregação' })
  @ApiResponse({
    status: 200,
    description: 'Dados de vendas',
    schema: {
      example: [
        {
          date: '2026-04-18',
          count: 10,
          total: 5000.0,
        },
      ],
    },
  })
  @ApiResponse({ status: 401, description: 'Não autenticado' })
  async getSalesAnalytics(@Query('period') period?: string) {
    return this.ordersService.getSalesAnalytics(period || 'week')
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get('analytics/status')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Análise por status',
    description: 'Retorna contagem de pedidos agrupados por status.',
  })
  @ApiResponse({
    status: 200,
    description: 'Dados por status',
    schema: {
      example: [
        {
          status: 'pending',
          count: 25,
        },
        {
          status: 'completed',
          count: 150,
        },
      ],
    },
  })
  @ApiResponse({ status: 401, description: 'Não autenticado' })
  async getStatusAnalytics() {
    return this.ordersService.getStatusAnalytics()
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get('analytics/revenue')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Análise de receita',
    description: 'Retorna receita comparando períodos (hoje vs semana passada, etc).',
  })
  @ApiResponse({
    status: 200,
    description: 'Dados de receita',
    schema: {
      example: {
        today: 1500.0,
        thisWeek: 8500.0,
        thisMonth: 45000.0,
        deltaWeek: '12.5%',
        deltaMonth: '8.3%',
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Não autenticado' })
  async getRevenueAnalytics() {
    return this.ordersService.getRevenueAnalytics()
  }

  // ── Phase 17: Analytics Pro ─────────────────────────────────
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get('analytics/category-revenue')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Receita por categoria (Phase 17)', description: 'Participação de cada categoria no faturamento total.' })
  @ApiResponse({ status: 200, description: 'Array com categoria, receita e número de pedidos' })
  async getCategoryRevenue() {
    return this.ordersService.getCategoryRevenue()
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get('analytics/heatmap')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mapa de calor de vendas (Phase 17)', description: 'Receita agrupada por hora do dia e dia da semana.' })
  @ApiResponse({ status: 200, description: 'Array com dayOfWeek, hourOfDay e total' })
  async getRevenueHeatmap() {
    return this.ordersService.getRevenueHeatmap()
  }
  // ────────────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard, TenantAccessGuard)
  @Get(':id')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Obter pedido por ID',
    description: 'Retorna os detalhes de um pedido específico.',
  })
  @ApiParam({ name: 'id', type: String, description: 'ID do pedido' })
  @ApiResponse({
    status: 200,
    description: 'Detalhes do pedido',
  })
  @ApiResponse({
    status: 404,
    description: 'Pedido não encontrado',
  })
  async findOne(
    @Param('id') id: string,
    @Req() req: TenantContextRequest,
  ) {
    const order = await this.ordersService.findOne(id, getTenantContext(req))
    if (order && !isAdminUser(req.user)) {
      assertCustomerOwnership(req.user, order.customerId)
    }
    return order
  }

  @UseGuards(JwtAuthGuard, TenantAccessGuard)
  @Post()
  @Throttle({ checkout: { limit: 30, ttl: 60000 } })
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Criar novo pedido',
    description: 'Cria um novo pedido no sistema.',
  })
  @ApiResponse({
    status: 201,
    description: 'Pedido criado com sucesso',
    schema: {
      example: {
        order: {
          id: 'clx123456789',
          customerId: 'clxcustomer123',
          subtotal: 120.5,
          discount: 0,
          delivery: 0,
          total: 120.5,
          status: 'PENDING',
          paymentMethod: 'PIX',
          createdAt: '2026-04-18T15:10:00.000Z',
        },
        whatsapp: {
          channel: 'whatsapp_web',
          to: '5511999999999',
          body: 'Pedido confirmado...',
          url: 'https://wa.me/5511999999999?text=Pedido%20confirmado',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Dados inválidos',
  })
  async create(
    @Body() createOrderDto: CreateOrderDto,
    @Req() req: TenantContextRequest,
  ): Promise<CreateOrderResult> {
    assertCustomerOwnership(req.user, createOrderDto.customerId)
    const tenantContext = getTenantContext(req)
    const clientIp =
      (req.headers?.['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ||
      req.ip ||
      undefined
    return this.ordersService.create({
      ...createOrderDto,
      tenantId: tenantContext.tenantId,
      storeId: tenantContext.storeId,
      clientIp,
    })
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Put(':id')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Atualizar pedido',
    description: 'Atualiza os dados de um pedido existente.',
  })
  @ApiParam({ name: 'id', type: String, description: 'ID do pedido' })
  @ApiResponse({
    status: 200,
    description: 'Pedido atualizado com sucesso',
  })
  @ApiResponse({
    status: 404,
    description: 'Pedido não encontrado',
  })
  async update(@Param('id') id: string, @Body() updateOrderDto: UpdateOrderDto) {
    return this.ordersService.update(id, updateOrderDto)
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Put(':id/status')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Atualizar status do pedido',
    description: 'Muda o status de um pedido (pending, processing, shipped, delivered, cancelled).',
  })
  @ApiParam({ name: 'id', type: String, description: 'ID do pedido' })
  @ApiResponse({
    status: 200,
    description: 'Status atualizado com sucesso',
  })
  @ApiResponse({
    status: 404,
    description: 'Pedido não encontrado',
  })
  async updateStatus(@Param('id') id: string, @Body() { status, reason }: { status: string, reason?: string }) {
    return this.ordersService.updateStatus(id, status, reason)
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Delete(':id')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Deletar pedido',
    description: 'Remove um pedido do sistema.',
  })
  @ApiParam({ name: 'id', type: String, description: 'ID do pedido' })
  @ApiResponse({
    status: 200,
    description: 'Pedido deletado com sucesso',
  })
  @ApiResponse({
    status: 404,
    description: 'Pedido não encontrado',
  })
  async remove(@Param('id') id: string) {
    return this.ordersService.remove(id)
  }

  @Get('admin/fraud-logs')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Listar logs de tentativas de fraude em frete grátis' })
  async listFraudLogs(
    @Query('limit') limit?: string,
    @Query('vector') vector?: string,
  ) {
    return this.ordersService.listFraudLogs({
      limit: limit ? parseInt(limit, 10) : 100,
      vector,
    })
  }
}

@ApiTags('Admin Orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantAccessGuard, RolesGuard)
@Roles('admin')
@Controller('admin/orders')
export class AdminOrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  @ApiOperation({ summary: 'Listar pedidos OMS', description: 'Lista pedidos administrativos com escopo de tenant/loja.' })
  async findAll(
    @Req() req: TenantContextRequest,
    @Query('status') status?: string,
    @Query('paymentStatus') paymentStatus?: string,
    @Query('customerId') customerId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.ordersService.findAdminOrders(getTenantContext(req), {
      status,
      paymentStatus,
      customerId,
      limit: limit ? parseInt(limit, 10) : undefined,
    })
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalhar pedido OMS', description: 'Retorna pedido com itens e historico de eventos.' })
  async findOne(@Param('id') id: string, @Req() req: TenantContextRequest) {
    return this.ordersService.findAdminOrder(id, getTenantContext(req))
  }

  @Post(':id/events')
  @ApiOperation({ summary: 'Registrar evento do pedido', description: 'Acrescenta evento auditavel e opcionalmente atualiza status.' })
  async addEvent(
    @Param('id') id: string,
    @Body() dto: AddOrderEventDto,
    @Req() req: TenantContextRequest,
  ) {
    return this.ordersService.addOrderEvent(id, dto, getTenantContext(req), this.actorFromRequest(req))
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancelar pedido', description: 'Cancela pedido inteiro e registra evento OMS.' })
  async cancel(
    @Param('id') id: string,
    @Body() dto: CancelOrderDto,
    @Req() req: TenantContextRequest,
  ) {
    return this.ordersService.cancelOrder(id, dto.reason, getTenantContext(req), this.actorFromRequest(req))
  }

  @Post(':id/items/:itemId/cancel')
  @ApiOperation({ summary: 'Cortar item do pedido', description: 'Cancela apenas um item, recalcula totais e registra evento.' })
  async cancelItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: CancelOrderItemDto,
    @Req() req: TenantContextRequest,
  ) {
    return this.ordersService.cancelOrderItem(id, itemId, dto, getTenantContext(req), this.actorFromRequest(req))
  }

  @Post(':id/items/:itemId/substitute')
  @ApiOperation({ summary: 'Substituir item do pedido', description: 'Cria item substituto, vincula ao item original, recalcula totais e registra evento.' })
  async substituteItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: SubstituteOrderItemDto,
    @Req() req: TenantContextRequest,
  ) {
    return this.ordersService.substituteOrderItem(id, itemId, dto, getTenantContext(req), this.actorFromRequest(req))
  }

  @Post(':id/recalculate')
  @ApiOperation({ summary: 'Recalcular pedido', description: 'Recalcula totais finais a partir dos itens operacionais e registra evento.' })
  async recalculate(@Param('id') id: string, @Req() req: TenantContextRequest) {
    return this.ordersService.recalculateOrder(id, getTenantContext(req), this.actorFromRequest(req))
  }

  private actorFromRequest(req: TenantContextRequest) {
    return {
      actorType: 'ADMIN',
      actorId: req.user?.id,
    }
  }
}
