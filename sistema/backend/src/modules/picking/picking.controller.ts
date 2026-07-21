import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Roles } from '../../common/decorators/roles.decorator'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { TenantAccessGuard } from '../../common/guards/tenant-access.guard'
import { getTenantContext, TenantContextRequest } from '../../common/tenant/tenant-context'
import {
  AssignPickingTaskDto,
  ConferencePickingTaskDto,
  CreatePickingTaskDto,
  FinishPickingTaskDto,
  MissingPickingItemDto,
  PackingChecklistDto,
  PickPickingItemDto,
  SubstitutePickingItemDto,
} from './dto/picking.dto'
import { PickingService } from './picking.service'

@ApiTags('Admin Picking')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantAccessGuard, RolesGuard)
@Roles('admin')
@Controller('admin/picking')
export class AdminPickingController {
  constructor(private readonly pickingService: PickingService) {}

  @Get('eligible-orders')
  @ApiOperation({ summary: 'Listar pedidos elegiveis para separacao' })
  async listEligibleOrders(@Req() req: TenantContextRequest, @Query('limit') limit?: string) {
    return this.pickingService.listEligibleOrders(getTenantContext(req), limit ? parseInt(limit, 10) : undefined)
  }

  @Get('tasks')
  @ApiOperation({ summary: 'Listar fila de separacao' })
  async listTasks(
    @Req() req: TenantContextRequest,
    @Query('status') status?: string,
    @Query('assignedToId') assignedToId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.pickingService.listTasks(getTenantContext(req), {
      status,
      assignedToId,
      limit: limit ? parseInt(limit, 10) : undefined,
    })
  }

  @Post('tasks')
  @ApiOperation({ summary: 'Criar tarefa de separacao a partir de pedido' })
  async createTask(@Body() dto: CreatePickingTaskDto, @Req() req: TenantContextRequest) {
    return this.pickingService.ensureTaskForOrder(dto.orderId, getTenantContext(req), dto, this.actorFromRequest(req))
  }

  @Post('tasks/from-order/:orderId')
  @ApiOperation({ summary: 'Garantir tarefa de separacao para um pedido' })
  async createTaskFromOrder(@Param('orderId') orderId: string, @Body() dto: Partial<CreatePickingTaskDto>, @Req() req: TenantContextRequest) {
    return this.pickingService.ensureTaskForOrder(orderId, getTenantContext(req), dto, this.actorFromRequest(req))
  }

  @Get('tasks/:id')
  @ApiOperation({ summary: 'Detalhar tarefa de separacao' })
  async findTask(@Param('id') id: string, @Req() req: TenantContextRequest) {
    return this.pickingService.findTask(id, getTenantContext(req))
  }

  @Post('tasks/:id/assign')
  @ApiOperation({ summary: 'Atribuir separador manualmente' })
  async assignTask(@Param('id') id: string, @Body() dto: AssignPickingTaskDto, @Req() req: TenantContextRequest) {
    return this.pickingService.assignTask(id, dto.pickerId, getTenantContext(req), this.actorFromRequest(req))
  }

  @Post('tasks/:id/start')
  @ApiOperation({ summary: 'Iniciar separacao' })
  async startTask(@Param('id') id: string, @Req() req: TenantContextRequest) {
    return this.pickingService.startTask(id, getTenantContext(req), this.actorFromRequest(req))
  }

  @Post('tasks/:id/items/:itemId/pick')
  @ApiOperation({ summary: 'Confirmar item separado' })
  async pickItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: PickPickingItemDto,
    @Req() req: TenantContextRequest,
  ) {
    return this.pickingService.pickItem(id, itemId, dto, getTenantContext(req), this.actorFromRequest(req))
  }

  @Post('tasks/:id/items/:itemId/missing')
  @ApiOperation({ summary: 'Marcar item faltante e acionar fluxo de substituicao' })
  async markItemMissing(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: MissingPickingItemDto,
    @Req() req: TenantContextRequest,
  ) {
    return this.pickingService.markItemMissing(id, itemId, dto, getTenantContext(req), this.actorFromRequest(req))
  }

  @Post('tasks/:id/items/:itemId/substitute')
  @ApiOperation({ summary: 'Registrar substituicao durante a separacao' })
  async substituteItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: SubstitutePickingItemDto,
    @Req() req: TenantContextRequest,
  ) {
    return this.pickingService.substituteItem(id, itemId, dto, getTenantContext(req), this.actorFromRequest(req))
  }

  @Post('tasks/:id/finish')
  @ApiOperation({ summary: 'Finalizar separacao e enviar para conferencia' })
  async finishTask(@Param('id') id: string, @Body() dto: FinishPickingTaskDto, @Req() req: TenantContextRequest) {
    return this.pickingService.finishTask(id, dto, getTenantContext(req), this.actorFromRequest(req))
  }

  @Post('tasks/:id/conference')
  @ApiOperation({ summary: 'Conferir divergencias e gerar checklist de embalagem' })
  async conferenceTask(@Param('id') id: string, @Body() dto: ConferencePickingTaskDto, @Req() req: TenantContextRequest) {
    return this.pickingService.conferenceTask(id, dto, getTenantContext(req), this.actorFromRequest(req))
  }

  @Post('tasks/:id/packing-checklist')
  @ApiOperation({ summary: 'Concluir checklist de embalagem e liberar pedido' })
  async completePackingChecklist(@Param('id') id: string, @Body() dto: PackingChecklistDto, @Req() req: TenantContextRequest) {
    return this.pickingService.completePackingChecklist(id, dto, getTenantContext(req), this.actorFromRequest(req))
  }

  @Get('performance')
  @ApiOperation({ summary: 'Indicadores de produtividade de separacao' })
  async getPerformance(
    @Req() req: TenantContextRequest,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.pickingService.getPerformance(getTenantContext(req), { from, to })
  }

  private actorFromRequest(req: TenantContextRequest) {
    return {
      actorType: 'ADMIN',
      actorId: req.user?.id,
    }
  }
}
