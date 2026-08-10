import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { RequireModule } from '../../common/decorators/require-module.decorator'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { ModuleAccessGuard } from '../../common/guards/module-access.guard'
import { TenantAccessGuard } from '../../common/guards/tenant-access.guard'
import { getTenantContext, TenantContextRequest } from '../../common/tenant/tenant-context'
import {
  AddItemToOrderDto,
  FinishPickingTaskDto,
  MissingPickingItemDto,
  PickPickingItemDto,
  ResetPickedItemDto,
  SubstitutePickingItemDto,
} from './dto/picking.dto'
import { PickingService } from './picking.service'
import { RelaxedThrottle } from '../../common/decorators/relaxed-throttle.decorator'

@ApiTags('Picker')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantAccessGuard, ModuleAccessGuard)
@RequireModule('picking')
@RelaxedThrottle()
@Controller('picker')
export class PickerController {
  constructor(private readonly pickingService: PickingService) {}

  @Get('orders')
  @ApiOperation({ summary: 'Buscar pedidos com filtros' })
  async searchOrders(
    @Req() req: TenantContextRequest,
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.pickingService.searchOrders(getTenantContext(req), { q, status, dateFrom, dateTo })
  }

  @Post('orders/:orderId/start')
  @ApiOperation({ summary: 'Iniciar separacao de um pedido' })
  async startOrderPicking(
    @Param('orderId') orderId: string,
    @Req() req: TenantContextRequest,
  ) {
    const ctx = getTenantContext(req)
    const actor = this.actorFromRequest(req)
    const task = await this.pickingService.ensureTaskForOrder(orderId, ctx, { assignedToId: req.user?.id }, actor)
    if (['PENDING', 'WAITING_SUBSTITUTION'].includes(task.status)) {
      return this.pickingService.startTask(task.id, ctx, actor)
    }
    return task
  }

  @Post('orders/:orderId/send-to-cashier')
  @ApiOperation({ summary: 'Enviar pedido separado para o caixa' })
  async sendToCashier(
    @Param('orderId') orderId: string,
    @Body() body: { deliveryInstructions?: string },
    @Req() req: TenantContextRequest,
  ) {
    return this.pickingService.sendToCashier(orderId, getTenantContext(req), this.actorFromRequest(req), body?.deliveryInstructions)
  }

  @Get('tasks')
  @ApiOperation({ summary: 'Listar minhas tarefas de separacao' })
  async listMyTasks(
    @Req() req: TenantContextRequest,
    @Query('status') status?: string,
  ) {
    const pickerId = req.user?.id
    return this.pickingService.listTasks(getTenantContext(req), {
      assignedToId: pickerId,
      status,
    })
  }

  @Get('tasks/available')
  @ApiOperation({ summary: 'Listar tarefas disponiveis para assumir' })
  async listAvailableTasks(@Req() req: TenantContextRequest) {
    const all = await this.pickingService.listTasks(getTenantContext(req), { status: 'PENDING' })
    return all.filter((t: any) => !t.assignedToId)
  }

  @Get('tasks/:id')
  @ApiOperation({ summary: 'Detalhar tarefa de separacao' })
  async findTask(@Param('id') id: string, @Req() req: TenantContextRequest) {
    return this.pickingService.findTask(id, getTenantContext(req))
  }

  @Post('tasks/:id/claim')
  @ApiOperation({ summary: 'Assumir tarefa nao atribuida' })
  async claimTask(@Param('id') id: string, @Req() req: TenantContextRequest) {
    const pickerId = req.user?.id
    return this.pickingService.assignTask(id, pickerId, getTenantContext(req), this.actorFromRequest(req))
  }

  @Post('tasks/:id/start')
  @ApiOperation({ summary: 'Iniciar separacao' })
  async startTask(@Param('id') id: string, @Req() req: TenantContextRequest) {
    return this.pickingService.startTask(id, getTenantContext(req), this.actorFromRequest(req))
  }

  @Post('tasks/:id/items/:itemId/pick')
  @ApiOperation({ summary: 'Confirmar item separado (scan, digitacao ou marcacao)' })
  async pickItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: PickPickingItemDto,
    @Req() req: TenantContextRequest,
  ) {
    return this.pickingService.pickItem(id, itemId, dto, getTenantContext(req), this.actorFromRequest(req))
  }

  @Post('tasks/:id/items/:itemId/missing')
  @ApiOperation({ summary: 'Marcar item faltante' })
  async markItemMissing(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: MissingPickingItemDto,
    @Req() req: TenantContextRequest,
  ) {
    return this.pickingService.markItemMissing(id, itemId, dto, getTenantContext(req), this.actorFromRequest(req))
  }

  @Post('tasks/:id/items/:itemId/substitute')
  @ApiOperation({ summary: 'Registrar substituicao' })
  async substituteItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: SubstitutePickingItemDto,
    @Req() req: TenantContextRequest,
  ) {
    return this.pickingService.substituteItem(id, itemId, dto, getTenantContext(req), this.actorFromRequest(req))
  }

  @Post('tasks/:id/items/:itemId/reset')
  @ApiOperation({ summary: 'Desfazer separacao de item (reabrir para correcao)' })
  async resetPickedItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: ResetPickedItemDto,
    @Req() req: TenantContextRequest,
  ) {
    return this.pickingService.resetPickedItem(id, itemId, dto, getTenantContext(req), this.actorFromRequest(req))
  }

  @Post('tasks/:id/items/:itemId/remove')
  @ApiOperation({ summary: 'Remover item incluido durante separacao' })
  async removeAddedItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Req() req: TenantContextRequest,
  ) {
    return this.pickingService.removeAddedItem(id, itemId, getTenantContext(req), this.actorFromRequest(req))
  }

  @Post('orders/:orderId/add-item')
  @ApiOperation({ summary: 'Incluir produto no pedido durante separacao' })
  async addItemToOrder(
    @Param('orderId') orderId: string,
    @Body() dto: AddItemToOrderDto,
    @Req() req: TenantContextRequest,
  ) {
    return this.pickingService.addItemToOrder(orderId, dto, getTenantContext(req), this.actorFromRequest(req))
  }

  @Get('products/search')
  @ApiOperation({ summary: 'Buscar produtos para inclusao' })
  async searchProducts(
    @Query('q') q: string,
    @Req() req: TenantContextRequest,
  ) {
    const ctx = getTenantContext(req)
    const term = (q || '').trim()
    if (term.length < 2) return []

    const prisma = this.pickingService['prisma']
    const select = { id: true, name: true, ean: true, price: true, promotionalPrice: true, unit: true }
    const LIMIT = 15

    // Prioriza correspondencias no inicio do nome ou EAN exato, depois preenche com "contem"
    // — sem isso, produtos com o termo no meio do nome (ex: "Bolo de Cenoura") dominavam os
    // 10 primeiros resultados e escondiam o produto mais obvio (ex: "Cenoura kg").
    const startsWith = await prisma.product.findMany({
      where: {
        tenantId: ctx.tenantId,
        storeId: ctx.storeId,
        active: true,
        OR: [
          { name: { startsWith: term, mode: 'insensitive' } },
          { ean: term },
        ],
      },
      select,
      orderBy: { name: 'asc' },
      take: LIMIT,
    })

    if (startsWith.length >= LIMIT) return startsWith

    const excludeIds = startsWith.map((p) => p.id)
    const contains = await prisma.product.findMany({
      where: {
        tenantId: ctx.tenantId,
        storeId: ctx.storeId,
        active: true,
        id: { notIn: excludeIds },
        OR: [
          { name: { contains: term, mode: 'insensitive' } },
          { ean: { contains: term } },
        ],
      },
      select,
      orderBy: { name: 'asc' },
      take: LIMIT - startsWith.length,
    })

    return [...startsWith, ...contains]
  }

  @Post('tasks/:id/finish')
  @ApiOperation({ summary: 'Finalizar separacao' })
  async finishTask(@Param('id') id: string, @Body() dto: FinishPickingTaskDto, @Req() req: TenantContextRequest) {
    return this.pickingService.finishTask(id, dto, getTenantContext(req), this.actorFromRequest(req))
  }

  @Get('me')
  @ApiOperation({ summary: 'Dados do separador logado' })
  async getMe(@Req() req: TenantContextRequest) {
    return {
      id: req.user?.id,
      name: req.user?.name,
      email: req.user?.email,
      role: req.user?.role,
    }
  }

  private actorFromRequest(req: TenantContextRequest) {
    return {
      actorType: 'PICKER',
      actorId: req.user?.id,
    }
  }
}
