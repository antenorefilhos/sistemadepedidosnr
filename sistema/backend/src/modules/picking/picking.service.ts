import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { CUSTOMER_SAFE_SELECT } from '../../common/customer-safe-select'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../../common/prisma.service'
import { NotificationsService } from '../notifications/notifications.service'
import { Logger } from '@nestjs/common'
import { AntenorApiService } from '../integrations/antenor-api.service'
import { IntegrationModulesService } from '../integrations/integration-modules.service'
import { DEFAULT_STORE_ID, DEFAULT_TENANT_ID } from '../../common/tenant/tenant.constants'
import { TenantContext, tenantStoreWhere } from '../../common/tenant/tenant-context'
import { resolveDateRange } from '../../common/date-range.util'
import {
  AddItemToOrderDto,
  ConferencePickingTaskDto,
  CreatePickingTaskDto,
  FinishPickingTaskDto,
  MissingPickingItemDto,
  PackingChecklistDto,
  PickPickingItemDto,
  ResetPickedItemDto,
  SubstitutePickingItemDto,
  SuggestSubstitutionDto,
} from './dto/picking.dto'
import { buildSubstitutionMessage, quantityLabel, SUBSTITUTION_REPLY_MINUTES, whatsappLink } from './substitution-message'

type PickingTenantContext = Pick<TenantContext, 'tenantId' | 'storeId'>

type PickingActor = {
  actorType?: string
  actorId?: string
}

type PickingTaskWithItems = Prisma.PickingTaskGetPayload<{
  include: { items: true }
}>

type OrderForPicking = Prisma.OrderGetPayload<{
  include: { customer: { select: typeof CUSTOMER_SAFE_SELECT }; items: { include: { product: true } } }
}>

const FINAL_ITEM_STATUSES = ['PICKED', 'MISSING', 'SUBSTITUTED', 'CANCELLED']

// Pedido que ja foi para o caixa esta (ou vai estar) faturado no PDV: a
// separacao nao mexe mais nele. 29/09/2026 (DAV 102118/102119): o app voltava
// a mostrar "Revisar e enviar" depois do faturamento, o separador reenviava e
// o pedido JA ENTREGUE voltava para "no caixa" e depois "pronto para entrega",
// alem de reenviar os itens ao ERP num DAV ja faturado.
const PAST_CASHIER_STATUSES = [
  'READY_FOR_CHECKOUT',
  'READY_FOR_PICKUP',
  'READY_FOR_DELIVERY',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'COMPLETED',
  'PARTIALLY_CANCELLED',
  'CANCELLED',
  'REFUNDED',
]

@Injectable()
export class PickingService {
  private readonly logger = new Logger(PickingService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly antenorApi: AntenorApiService,
    private readonly integrationModules: IntegrationModulesService,
  ) {}

  async searchOrders(
    context: Partial<PickingTenantContext>,
    filters: { q?: string; status?: string; dateFrom?: string; dateTo?: string } = {},
  ) {
    const scopedWhere = tenantStoreWhere(context)
    const where: Prisma.OrderWhereInput = { ...scopedWhere }

    if (filters.status) {
      where.status = filters.status
    }
    if (filters.dateFrom) {
      where.createdAt = { ...(where.createdAt as any || {}), gte: new Date(filters.dateFrom) }
    }
    if (filters.dateTo) {
      const end = new Date(filters.dateTo)
      end.setHours(23, 59, 59, 999)
      where.createdAt = { ...(where.createdAt as any || {}), lte: end }
    }
    if (filters.q) {
      const q = filters.q.trim()
      where.OR = [
        { id: { contains: q } },
        { customer: { name: { contains: q, mode: 'insensitive' } } },
        { customer: { cpf: { contains: q } } },
      ]
    }

    const orders = await this.prisma.order.findMany({
      where,
      include: {
        customer: { select: CUSTOMER_SAFE_SELECT },
        items: { include: { product: true } },
      },
      orderBy: [{ createdAt: 'desc' }],
      take: 100,
    })

    const tasksByOrder = await this.prisma.pickingTask.findMany({
      where: { ...scopedWhere, orderId: { in: orders.map(o => o.id) } },
      include: { items: true },
    })
    const taskMap = new Map(tasksByOrder.map(t => [t.orderId, t]))

    return orders.map(order => ({
      ...order,
      pickingTask: taskMap.get(order.id) || null,
    }))
  }

  async sendToCashier(
    orderId: string,
    context: Partial<PickingTenantContext>,
    actor?: PickingActor,
    deliveryInstructions?: string,
  ) {
    const order = await this.findOrderForPicking(orderId, context)
    // Ja no caixa: reenviar nao faz nada (sem novo evento, sem reenviar ao ERP).
    if (order.status === 'READY_FOR_CHECKOUT') {
      return this.prisma.order.findUniqueOrThrow({
        where: { id: order.id },
        include: { customer: { select: CUSTOMER_SAFE_SELECT }, items: { include: { product: true } } },
      })
    }
    this.assertStillInPicking(order.status)
    const task = await this.prisma.pickingTask.findFirst({
      where: { orderId, ...tenantStoreWhere(context) },
      include: { items: true },
    })

    if (task) {
      const pendingItems = task.items.filter(item => !FINAL_ITEM_STATUSES.includes(item.status))
      if (pendingItems.length > 0) {
        throw new BadRequestException('Ainda existem itens pendentes de separacao.')
      }
      await this.settleSuggestionsBeforeCashier(order.id, actor)
      // 29/09/2026: antes pulava CONFERENCE_PENDING/PACKING -- etapas que o
      // fluxo real nao usa (o separador envia direto ao caixa). A tarefa ficava
      // aberta para sempre: 13 "aguardando conferencia" com pedido ja
      // entregue/cancelado, e nenhuma tarefa concluida na historia.
      if (!['COMPLETED', 'CANCELLED'].includes(task.status)) {
        await this.prisma.pickingTask.update({
          where: { id: task.id },
          data: { status: 'COMPLETED', completedAt: task.completedAt || new Date() },
        })
      }
    }

    const updateData: any = { status: 'READY_FOR_CHECKOUT' }
    if (deliveryInstructions !== undefined) {
      updateData.deliveryInstructions = deliveryInstructions || null
    }

    const updated = await this.prisma.order.update({
      where: { id: order.id },
      data: updateData,
      include: { customer: { select: CUSTOMER_SAFE_SELECT }, items: { include: { product: true } } },
    })

    await this.recordOrderEvent(updated, 'order.sent_to_cashier', {
      taskId: task?.id || null,
      deliveryInstructions: deliveryInstructions || null,
    }, actor)

    this.notificationsService.notifyOrderStatusChange(order.id, 'READY_FOR_CHECKOUT').catch(() => {})

    // Sincroniza peso ajustado e corte de volta pro ERP (JON-29), pra o
    // operador do caixa nao ter que reconferir tudo na mao ao importar o DAV.
    // Best-effort: erro aqui nao pode travar o pedido de ir pro caixa fisico,
    // e nao ha fila de retentativa -- se falhar, o operador so perde a
    // comodidade, ajusta na mao como fazia antes.
    if (updated.erpDav && (await this.integrationModules.isEnabled('antenorapi'))) {
      // Agrupado por erpProductId antes de mandar: o mesmo produto pode virar
      // DUAS linhas em order_items (ex.: separador adiciona "mais um" do
      // mesmo item durante a separacao, em vez de aumentar a quantidade da
      // linha existente). Mandar as duas linhas separadas pro PUT faria o
      // ERP receber duas entradas com o mesmo cdProduto -- a ultima venceria
      // e a quantidade real ficaria pela metade, sem erro nenhum aparecer.
      const porProduto = new Map<number, { quantidade: number; cutReason?: string; algumAtivo: boolean }>()
      for (const item of updated.items) {
        const erpProductId = item.product?.erpProductId
        if (erpProductId == null) continue

        const cortado = item.status === 'MISSING'
        const atual = porProduto.get(erpProductId) || { quantidade: 0, algumAtivo: false }
        if (!cortado) {
          atual.quantidade += Number(item.fulfilledQuantity ?? item.quantity)
          atual.algumAtivo = true
        } else if (!atual.cutReason) {
          atual.cutReason = item.cutReason || undefined
        }
        porProduto.set(erpProductId, atual)
      }

      const itensComErp = Array.from(porProduto.entries()).map(([erpProductId, dados]) => ({
        erpProductId,
        quantidade: dados.quantidade,
        cancelado: !dados.algumAtivo,
        motivoCorte: !dados.algumAtivo ? dados.cutReason : undefined,
      }))

      if (itensComErp.length > 0) {
        this.antenorApi.updatePickedItems(updated.erpDav, itensComErp).catch((error) => {
          this.logger.warn(`Falha ao sincronizar itens separados do pedido ${order.id} no ERP`, error)
        })
      }
    }

    return updated
  }

  async listEligibleOrders(context: Partial<PickingTenantContext>, limit = 50) {
    const scopedWhere = tenantStoreWhere(context)
    const existingTasks = await this.prisma.pickingTask.findMany({
      where: scopedWhere,
      select: { orderId: true },
    })
    const orderIdsWithTask = existingTasks.map((task) => task.orderId)

    return this.prisma.order.findMany({
      where: {
        ...scopedWhere,
        id: orderIdsWithTask.length > 0 ? { notIn: orderIdsWithTask } : undefined,
        status: { in: ['CONFIRMED', 'PICKING_PENDING'] },
      },
      include: {
        customer: { select: CUSTOMER_SAFE_SELECT },
        items: { include: { product: true } },
      },
      orderBy: [{ createdAt: 'asc' }],
      take: Math.min(Math.max(Number(limit || 50), 1), 200),
    })
  }

  async listTasks(context: Partial<PickingTenantContext>, filters: { status?: string; assignedToId?: string; limit?: number } = {}) {
    const limit = Math.min(Math.max(Number(filters.limit || 50), 1), 200)
    const where: Prisma.PickingTaskWhereInput = {
      ...tenantStoreWhere(context),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.assignedToId ? { assignedToId: filters.assignedToId } : {}),
    }

    const tasks = await this.prisma.pickingTask.findMany({
      where,
      include: { items: true },
      orderBy: [{ priority: 'desc' }, { slaDueAt: 'asc' }, { createdAt: 'asc' }],
      take: limit,
    })

    return this.attachTaskDetails(tasks, context)
  }

  async findTask(id: string, context: Partial<PickingTenantContext>) {
    const task = await this.findTaskForOperation(id, context)
    const [detailed] = await this.attachTaskDetails([task], context)
    return detailed
  }

  async ensureTaskForOrder(
    orderId: string,
    context: Partial<PickingTenantContext>,
    dto: Partial<CreatePickingTaskDto> = {},
    actor?: PickingActor,
  ) {
    const order = await this.findOrderForPicking(orderId, context)

    const existing = await this.prisma.pickingTask.findFirst({
      where: { orderId, tenantId: order.tenantId, storeId: order.storeId },
      include: { items: true },
    })
    if (existing) {
      const [detailed] = await this.attachTaskDetails([existing], context)
      return detailed
    }

    if (['CANCELLED', 'COMPLETED', 'REFUNDED'].includes(order.status)) {
      throw new BadRequestException('Pedido nao esta elegivel para separacao.')
    }

    const activeItems = order.items.filter((item) => !['CANCELLED', 'SUBSTITUTED'].includes(item.status))
    if (activeItems.length === 0) {
      throw new BadRequestException('Pedido nao possui itens ativos para separacao.')
    }

    const slaDueAt = dto.slaDueAt ? new Date(dto.slaDueAt) : this.defaultSlaDueAt(order.createdAt)
    const task = await this.prisma.pickingTask.create({
      data: {
        tenantId: order.tenantId,
        storeId: order.storeId,
        orderId: order.id,
        assignedToId: dto.assignedToId || null,
        slaDueAt,
        priority: dto.priority ?? this.priorityForSla(slaDueAt),
        status: 'PENDING',
        items: {
          create: activeItems.map((item) => ({
            tenantId: order.tenantId,
            storeId: order.storeId,
            orderItemId: item.id,
            productId: item.productId,
            requestedQuantity: this.decimal3(this.numberValue(item.requestedQuantity) ?? item.quantity),
            status: 'PENDING',
          })),
        },
      },
      include: { items: true },
    })

    const updatedOrder = await this.prisma.order.update({
      where: { id: order.id },
      data: { status: 'PICKING_PENDING' },
      include: {
        customer: { select: CUSTOMER_SAFE_SELECT },
        items: { include: { product: true } },
      },
    })
    // Avisa o celular de quem separa. Fora do await de proposito: push fora
    // do ar nao pode impedir a tarefa de existir.
    this.notificationsService
      .notifyPickingTeamNewOrder(order.id, task.items.length)
      .catch(() => {})

    await this.recordOrderEvent(updatedOrder, 'order.picking_task_created', {
      taskId: task.id,
      assignedToId: task.assignedToId,
      slaDueAt: task.slaDueAt?.toISOString() || null,
      itemCount: task.items.length,
    }, actor)

    this.notificationsService.notifyOrderStatusChange(order.id, 'PICKING_PENDING').catch(() => {})

    const [detailed] = await this.attachTaskDetails([task], context)
    return detailed
  }

  async assignTask(id: string, pickerId: string, context: Partial<PickingTenantContext>, actor?: PickingActor) {
    const task = await this.findTaskForOperation(id, context)
    if (['COMPLETED', 'CANCELLED'].includes(task.status)) {
      throw new BadRequestException('Tarefa de separacao ja esta encerrada.')
    }
    const updated = await this.prisma.pickingTask.update({
      where: { id: task.id },
      data: { assignedToId: pickerId },
      include: { items: true },
    })
    const order = await this.findOrderForPicking(task.orderId, context)
    await this.recordOrderEvent(order, 'order.picking_assigned', {
      taskId: task.id,
      previousAssignedToId: task.assignedToId || null,
      assignedToId: pickerId,
    }, actor)

    const [detailed] = await this.attachTaskDetails([updated], context)
    return detailed
  }

  async startTask(id: string, context: Partial<PickingTenantContext>, actor?: PickingActor) {
    const task = await this.findTaskForOperation(id, context)
    if (['COMPLETED', 'CANCELLED'].includes(task.status)) {
      throw new BadRequestException('Tarefa de separacao ja esta encerrada.')
    }
    // Dois separadores abrindo o mesmo pedido ao mesmo tempo pegavam a mesma
    // tarefa sem aviso -- se ja esta IN_PROGRESS com outro separador
    // atribuido, barra em vez de deixar um segundo entrar por cima.
    if (task.status === 'IN_PROGRESS' && task.assignedToId && actor?.actorId && task.assignedToId !== actor.actorId) {
      throw new BadRequestException('Pedido ja esta sendo separado por outro membro da equipe.')
    }

    const startedAt = task.startedAt || new Date()
    const assignedToId = task.assignedToId || actor?.actorId || null

    // JON-73 (Auditoria 360, Medium): a checagem acima le e decide em
    // memoria; o update por id nao confere se o status ainda e o mesmo que
    // foi lido. Dois separadores abrindo a MESMA tarefa PENDING ao mesmo
    // tempo passavam os dois pela checagem antes de qualquer um escrever, e
    // os dois escreviam -- o segundo silenciosamente sobrescrevia o
    // primeiro. Claim atomico: so grava se o status no banco ainda for o
    // mesmo que foi lido aqui (igual ao padrao de reserva de estoque/outbox).
    const claim = await this.prisma.pickingTask.updateMany({
      where: { id: task.id, status: task.status },
      data: {
        status: 'IN_PROGRESS',
        startedAt,
        assignedToId,
      },
    })
    if (claim.count !== 1) {
      throw new BadRequestException('Pedido ja esta sendo separado por outro membro da equipe.')
    }
    const updated = await this.prisma.pickingTask.findUniqueOrThrow({
      where: { id: task.id },
      include: { items: true },
    })
    const order = await this.prisma.order.update({
      where: { id: task.orderId },
      data: { status: 'PICKING' },
      include: {
        customer: { select: CUSTOMER_SAFE_SELECT },
        items: { include: { product: true } },
      },
    })
    await this.recordOrderEvent(order, 'order.picking_started', {
      taskId: task.id,
      assignedToId,
      startedAt: startedAt.toISOString(),
    }, actor)

    this.notificationsService.notifyOrderStatusChange(task.orderId, 'PICKING').catch(() => {})

    const [detailed] = await this.attachTaskDetails([updated], context)
    return detailed
  }

  async pickItem(
    taskId: string,
    taskItemId: string,
    dto: PickPickingItemDto,
    context: Partial<PickingTenantContext>,
    actor?: PickingActor,
  ) {
    const task = await this.ensureTaskCanReceiveItems(taskId, context, actor)
    const taskItem = this.getTaskItem(task, taskItemId)
    const orderItem = await this.findOrderItemForTask(task, taskItem.orderItemId)

    const pickedQuantity = Number(dto.quantity)
    if (!Number.isFinite(pickedQuantity) || pickedQuantity <= 0) {
      throw new BadRequestException('Quantidade separada invalida.')
    }

    const isWeighted = Boolean(orderItem.product?.isFractional) || ['kg', 'quilo', 'g'].includes(String(orderItem.product?.unit || '').toLowerCase())
    if (isWeighted && (dto.finalWeight === undefined || dto.finalWeight === null)) {
      throw new BadRequestException('Produto por peso exige peso final informado.')
    }

    const fulfilledQuantity = dto.finalWeight ?? pickedQuantity
    // App antigo em cache nao manda `method`: codigo informado vira BARCODE.
    const pickMethod = dto.method ?? (dto.barcode ? 'BARCODE' : 'MANUAL')
    const unitPrice = this.numberValue(orderItem.finalUnitPrice) ?? orderItem.unitPrice
    const finalSubtotal = this.roundMoney(unitPrice * fulfilledQuantity)

    const [updatedTaskItem, updatedOrderItem] = await Promise.all([
      this.prisma.pickingTaskItem.update({
        where: { id: taskItem.id },
        data: {
          status: 'PICKED',
          pickedQuantity: this.decimal3(pickedQuantity),
          finalWeight: dto.finalWeight !== undefined ? this.decimal3(dto.finalWeight) : null,
          barcode: dto.barcode || null,
          notes: dto.notes || null,
        },
      }),
      this.prisma.orderItem.update({
        where: { id: orderItem.id },
        data: {
          status: 'PICKED',
          fulfilledQuantity: this.decimal3(fulfilledQuantity),
          finalUnitPrice: this.decimal2(unitPrice),
          finalSubtotal: this.decimal2(finalSubtotal),
          pickerNotes: dto.notes || null,
          pickMethod,
          pickedBarcode: dto.barcode || null,
        },
        include: { product: true },
      }),
    ])

    const recalculated = await this.recalculateOrderTotals(task.orderId)
    await this.recordOrderEvent(recalculated, 'order.item_picked', {
      taskId: task.id,
      taskItemId: updatedTaskItem.id,
      orderItemId: updatedOrderItem.id,
      productId: orderItem.productId,
      productName: orderItem.product?.name || null,
      requestedQuantity: this.numberValue(taskItem.requestedQuantity),
      pickedQuantity,
      finalWeight: dto.finalWeight ?? null,
      fulfilledQuantity,
      finalSubtotal,
      barcode: dto.barcode || null,
      method: pickMethod,
      notes: dto.notes || null,
    }, actor)

    return this.findTask(task.id, context)
  }

  async markItemMissing(
    taskId: string,
    taskItemId: string,
    dto: MissingPickingItemDto,
    context: Partial<PickingTenantContext>,
    actor?: PickingActor,
  ) {
    const task = await this.ensureTaskCanReceiveItems(taskId, context, actor)
    const taskItem = this.getTaskItem(task, taskItemId)
    const orderItem = await this.findOrderItemForTask(task, taskItem.orderItemId)
    const requestSubstitution = dto.requestSubstitution ?? orderItem.substitutionPolicy !== 'DENY'
    const notes = dto.notes || dto.reason

    await Promise.all([
      this.prisma.pickingTaskItem.update({
        where: { id: taskItem.id },
        data: {
          status: 'MISSING',
          pickedQuantity: this.decimal3(0),
          finalWeight: null,
          notes,
        },
      }),
      this.prisma.orderItem.update({
        where: { id: orderItem.id },
        data: {
          status: 'MISSING',
          fulfilledQuantity: this.decimal3(0),
          finalSubtotal: this.decimal2(0),
          cutReason: dto.reason,
          pickerNotes: notes,
        },
      }),
    ])

    // 08/10/2026: item em falta deixou de pôr o pedido em "aguardando o
    // cliente" -- ninguem falava com ele. A espera comeca quando o separador
    // manda as trocas sugeridas pelo WhatsApp (sendSuggestions).
    await this.syncSubstitutionStatus(task.orderId)
    const order = await this.findOrderForPicking(task.orderId)
    const suggestions = requestSubstitution ? await this.findSubstitutionSuggestions(orderItem) : []
    await this.recordOrderEvent(order, 'order.item_missing', {
      taskId: task.id,
      taskItemId: taskItem.id,
      orderItemId: orderItem.id,
      productId: orderItem.productId,
      productName: orderItem.product?.name || null,
      reason: dto.reason,
      requestSubstitution,
      suggestions: suggestions.map((item) => ({ productId: item.id, name: item.name, ean: item.ean })),
    }, actor)

    return {
      task: await this.findTask(task.id, context),
      suggestions,
    }
  }

  async substituteItem(
    taskId: string,
    taskItemId: string,
    dto: SubstitutePickingItemDto,
    context: Partial<PickingTenantContext>,
    actor?: PickingActor,
    /** Troca sugerida aceita: vale o preco que o cliente viu e a leitura do separador. */
    accepted?: { unitPrice: number; pickMethod?: string | null; pickedBarcode?: string | null },
  ) {
    const task = await this.ensureTaskCanReceiveItems(taskId, context, actor)
    const taskItem = this.getTaskItem(task, taskItemId)
    const sourceOrderItem = await this.findOrderItemForTask(task, taskItem.orderItemId)
    const substitute = await this.prisma.product.findFirst({
      where: {
        id: dto.substituteProductId,
        tenantId: task.tenantId,
        storeId: task.storeId,
        active: true,
      },
    })
    if (!substitute) throw new NotFoundException('Produto substituto nao encontrado.')

    const quantity = dto.quantity ?? this.numberValue(taskItem.requestedQuantity) ?? sourceOrderItem.quantity
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new BadRequestException('Quantidade de substituicao invalida.')
    }

    const unitPrice = accepted?.unitPrice ?? substitute.promotionalPrice ?? substitute.price
    const subtotal = this.roundMoney(unitPrice * quantity)
    const substituteOrderItem = await this.prisma.orderItem.create({
      data: {
        tenantId: task.tenantId,
        storeId: task.storeId,
        orderId: task.orderId,
        productId: substitute.id,
        quantity,
        unitPrice,
        subtotal,
        requestedQuantity: this.decimal3(quantity),
        fulfilledQuantity: this.decimal3(quantity),
        finalUnitPrice: this.decimal2(unitPrice),
        finalSubtotal: this.decimal2(subtotal),
        status: 'PICKED',
        substitutionPolicy: sourceOrderItem.substitutionPolicy || 'ALLOW',
        pickerNotes: dto.notes || null,
        pickMethod: accepted?.pickMethod || null,
        pickedBarcode: accepted?.pickedBarcode || null,
      },
      include: { product: true },
    })

    await Promise.all([
      this.prisma.orderItem.update({
        where: { id: sourceOrderItem.id },
        data: {
          status: 'SUBSTITUTED',
          fulfilledQuantity: this.decimal3(0),
          finalSubtotal: this.decimal2(0),
          substitutedByItemId: substituteOrderItem.id,
          cutReason: dto.reason || null,
          pickerNotes: dto.notes || null,
        },
      }),
      this.prisma.pickingTaskItem.update({
        where: { id: taskItem.id },
        data: {
          status: 'SUBSTITUTED',
          pickedQuantity: this.decimal3(0),
          finalWeight: null,
          notes: dto.notes || dto.reason || null,
        },
      }),
      this.prisma.pickingTaskItem.create({
        data: {
          tenantId: task.tenantId,
          storeId: task.storeId,
          taskId: task.id,
          orderItemId: substituteOrderItem.id,
          productId: substitute.id,
          requestedQuantity: this.decimal3(quantity),
          pickedQuantity: this.decimal3(quantity),
          status: 'PICKED',
          notes: dto.notes || null,
        },
      }),
      this.prisma.pickingTask.update({
        where: { id: task.id },
        data: { status: 'IN_PROGRESS' },
      }),
    ])

    const recalculated = await this.recalculateOrderTotals(task.orderId)
    await this.recordOrderEvent(recalculated, 'order.substitution_accepted', {
      taskId: task.id,
      sourceTaskItemId: taskItem.id,
      sourceOrderItemId: sourceOrderItem.id,
      sourceProductId: sourceOrderItem.productId,
      sourceProductName: sourceOrderItem.product?.name || null,
      substituteOrderItemId: substituteOrderItem.id,
      substituteProductId: substitute.id,
      substituteProductName: substitute.name,
      quantity,
      unitPrice,
      subtotal,
      reason: dto.reason || null,
      notes: dto.notes || null,
    }, actor)

    return this.findTask(task.id, context)
  }

  // ---- Troca sugerida pelo separador (08/10/2026) --------------------------
  // Etapa 1: o separador sugere, manda pelo WhatsApp da loja e registra a
  // resposta do cliente. Etapa 2 (depois): link para o cliente decidir, que
  // atualiza estes mesmos registros -- os dois lados ficam sincronizados.

  async suggestSubstitution(
    taskId: string,
    taskItemId: string,
    dto: SuggestSubstitutionDto,
    context: Partial<PickingTenantContext>,
    actor?: PickingActor,
  ) {
    const task = await this.ensureTaskCanReceiveItems(taskId, context, actor)
    await this.assertOrderStillInPicking(task.orderId)
    const taskItem = this.getTaskItem(task, taskItemId)
    if (taskItem.status !== 'MISSING') {
      throw new BadRequestException('Sugira troca só para item marcado como em falta.')
    }
    const orderItem = await this.findOrderItemForTask(task, taskItem.orderItemId)
    if (orderItem.substitutionPolicy === 'DENY') {
      throw new BadRequestException('O cliente não aceita troca neste item.')
    }
    const product = await this.prisma.product.findFirst({
      where: { id: dto.productId, tenantId: task.tenantId, storeId: task.storeId, active: true },
    })
    if (!product) throw new NotFoundException('Produto não encontrado.')
    if (product.id === orderItem.productId) {
      throw new BadRequestException('Escolha um produto diferente do que faltou.')
    }
    const quantity = dto.quantity ?? this.numberValue(taskItem.requestedQuantity) ?? orderItem.quantity
    const unitPrice = product.promotionalPrice ?? product.price

    // Uma sugestao por item: a nova substitui a anterior ainda sem resposta.
    await this.prisma.substitutionSuggestion.updateMany({
      where: { orderItemId: orderItem.id, status: 'PENDING' },
      data: { status: 'CANCELLED', decidedAt: new Date(), decidedBy: 'PICKER' },
    })
    await this.prisma.substitutionSuggestion.create({
      data: {
        tenantId: task.tenantId,
        storeId: task.storeId,
        orderId: task.orderId,
        orderItemId: orderItem.id,
        productId: product.id,
        quantity: this.decimal3(quantity),
        unitPrice: this.decimal2(unitPrice),
        pickMethod: dto.method ?? (dto.barcode ? 'BARCODE' : null),
        pickedBarcode: dto.barcode || null,
        createdById: actor?.actorId || null,
      },
    })
    await this.syncSubstitutionStatus(task.orderId)
    return this.findTask(task.id, context)
  }

  async cancelSuggestion(suggestionId: string, context: Partial<PickingTenantContext>) {
    const suggestion = await this.findSuggestion(suggestionId, context)
    await this.assertOrderStillInPicking(suggestion.orderId)
    if (suggestion.status !== 'PENDING') throw new BadRequestException('Esta troca já foi decidida.')
    await this.prisma.substitutionSuggestion.update({
      where: { id: suggestion.id },
      data: { status: 'CANCELLED', decidedAt: new Date(), decidedBy: 'PICKER' },
    })
    await this.syncSubstitutionStatus(suggestion.orderId)
    return this.findTaskByOrder(suggestion.orderId, context)
  }

  /** Monta a mensagem do WhatsApp com as trocas pendentes e marca como enviadas. */
  async sendSuggestions(orderId: string, context: Partial<PickingTenantContext>, actor?: PickingActor) {
    const order = await this.findOrderForPicking(orderId, context)
    this.assertStillInPicking(order.status)
    const open = await this.prisma.substitutionSuggestion.findMany({
      where: { orderId, status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
    })
    if (!open.length) throw new BadRequestException('Nenhuma troca sugerida para enviar.')
    const unsent = open.filter((s) => !s.sentAt)

    const products = await this.prisma.product.findMany({ where: { id: { in: open.map((s) => s.productId) } } })
    const productById = new Map(products.map((p) => [p.id, p]))
    const settled = new Set(
      (await this.prisma.substitutionSuggestion.findMany({
        where: { orderId, status: { in: ['REJECTED', 'EXPIRED'] } },
        select: { orderItemId: true },
      })).map((s) => s.orderItemId),
    )
    const weighed = (p?: { isFractional?: boolean | null; unit?: string | null } | null) =>
      Boolean(p?.isFractional) || ['kg', 'quilo', 'g'].includes(String(p?.unit || '').toLowerCase())

    let extra = 0
    const lines = order.items
      .filter((item) => item.status === 'MISSING' && (open.some((s) => s.orderItemId === item.id) || !settled.has(item.id)))
      .map((item) => {
        const s = open.find((candidate) => candidate.orderItemId === item.id)
        const p = s ? productById.get(s.productId) : undefined
        if (!s || !p) return { originalName: item.product?.name || 'Produto', originalSubtotal: item.subtotal, suggestion: null }
        const qty = Number(s.quantity)
        const subtotal = this.roundMoney(Number(s.unitPrice) * qty)
        extra += subtotal
        return {
          originalName: item.product?.name || 'Produto',
          originalSubtotal: item.subtotal,
          suggestion: { name: p.name, quantityLabel: quantityLabel(qty, weighed(p)), subtotal },
        }
      })

    const totalWithout = this.roundMoney(order.total)
    const totalWith = this.roundMoney(order.total + extra)
    const message = buildSubstitutionMessage({
      customerName: order.customer?.name,
      orderCode: order.erpDav || `#${order.id.slice(-8).toUpperCase()}`,
      lines,
      totalWithout,
      totalWith,
      accountUrl: `${String(process.env.FRONTEND_URL || 'https://mercado.antenorefilhos.com.br').replace(/\/+$/, '')}/minha-conta`,
    })
    const whatsappUrl = whatsappLink(order.customer?.whatsapp, message)
    if (!whatsappUrl) throw new BadRequestException('O cliente não tem WhatsApp válido no cadastro. Ligue para ele.')

    if (unsent.length) {
      await this.prisma.substitutionSuggestion.updateMany({
        where: { id: { in: unsent.map((s) => s.id) } },
        data: { sentAt: new Date() },
      })
      await this.recordOrderEvent(order, 'order.substitution_suggested', {
        suggestions: open.map((s) => ({
          suggestionId: s.id,
          orderItemId: s.orderItemId,
          productId: s.productId,
          productName: productById.get(s.productId)?.name || null,
          quantity: Number(s.quantity),
          unitPrice: Number(s.unitPrice),
        })),
        totalWith,
        totalWithout,
      }, actor)
    }
    await this.syncSubstitutionStatus(orderId)
    if (unsent.length) this.notificationsService.notifyOrderStatusChange(orderId, 'WAITING_CUSTOMER_SUBSTITUTION').catch(() => {})

    return { message, whatsappUrl, task: await this.findTaskByOrder(orderId, context) }
  }

  /** Resposta do cliente, registrada pelo separador (etapa 1) ou pelo proprio cliente (etapa 2). */
  async decideSuggestion(
    suggestionId: string,
    accept: boolean,
    context: Partial<PickingTenantContext>,
    actor?: PickingActor,
    decidedBy: 'PICKER' | 'CUSTOMER' = 'PICKER',
  ) {
    const suggestion = await this.findSuggestion(suggestionId, context)
    await this.assertOrderStillInPicking(suggestion.orderId)
    if (suggestion.status !== 'PENDING') {
      const same = (accept && suggestion.status === 'ACCEPTED') || (!accept && suggestion.status === 'REJECTED')
      if (same) return this.findTaskByOrder(suggestion.orderId, context)
      throw new BadRequestException('Esta troca já foi decidida.')
    }
    if (!suggestion.sentAt) throw new BadRequestException('Envie a troca ao cliente antes de registrar a resposta.')

    if (accept) {
      const task = await this.prisma.pickingTask.findFirst({
        where: { orderId: suggestion.orderId, ...tenantStoreWhere(context) },
        include: { items: true },
      })
      const taskItem = task?.items.find((item) => item.orderItemId === suggestion.orderItemId)
      if (!task || !taskItem || taskItem.status !== 'MISSING') {
        throw new BadRequestException('O item original não está mais em falta.')
      }
      await this.substituteItem(
        task.id,
        taskItem.id,
        { substituteProductId: suggestion.productId, quantity: Number(suggestion.quantity), reason: 'Troca aceita pelo cliente' },
        context,
        actor,
        { unitPrice: Number(suggestion.unitPrice), pickMethod: suggestion.pickMethod, pickedBarcode: suggestion.pickedBarcode },
      )
      const original = await this.prisma.orderItem.findUnique({ where: { id: suggestion.orderItemId }, select: { substitutedByItemId: true } })
      await this.prisma.substitutionSuggestion.update({
        where: { id: suggestion.id },
        data: { status: 'ACCEPTED', decidedAt: new Date(), decidedBy, substituteOrderItemId: original?.substitutedByItemId || null },
      })
    } else {
      await this.prisma.substitutionSuggestion.update({
        where: { id: suggestion.id },
        data: { status: 'REJECTED', decidedAt: new Date(), decidedBy },
      })
      const order = await this.findOrderForPicking(suggestion.orderId)
      await this.recordOrderEvent(order, 'order.substitution_rejected', {
        suggestionId: suggestion.id,
        orderItemId: suggestion.orderItemId,
        productId: suggestion.productId,
        decidedBy,
      }, actor)
    }
    await this.syncSubstitutionStatus(suggestion.orderId)
    return this.findTaskByOrder(suggestion.orderId, context)
  }

  /**
   * O cliente escolhe as trocas pelo site, em Minha conta (etapa 2, 08/10/2026).
   * Grava na mesma sugestao em que o separador registra a resposta do WhatsApp:
   * quem decidir primeiro vale, e o outro lado ve a decisao.
   */
  async decideSuggestionsAsCustomer(
    orderId: string,
    customerId: string,
    decisions: Array<{ id: string; accept: boolean }>,
    context: Partial<PickingTenantContext>,
  ) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, ...tenantStoreWhere(context) },
      select: { id: true, customerId: true, erpDav: true, status: true },
    })
    if (!order || order.customerId !== customerId) throw new NotFoundException('Pedido não encontrado.')
    if (PAST_CASHIER_STATUSES.includes(order.status)) {
      throw new BadRequestException('A separação do seu pedido já terminou. Fale com a loja pelo WhatsApp.')
    }
    const suggestions = await this.prisma.substitutionSuggestion.findMany({
      where: { orderId, id: { in: decisions.map((d) => d.id) } },
      select: { id: true, status: true, sentAt: true },
    })
    if (!decisions.length || suggestions.length !== new Set(decisions.map((d) => d.id)).size) {
      throw new BadRequestException('Troca não encontrada neste pedido.')
    }
    if (suggestions.some((s) => s.status === 'EXPIRED')) {
      throw new BadRequestException('O prazo para responder passou e o pedido seguiu sem as trocas.')
    }
    if (suggestions.some((s) => !s.sentAt || s.status === 'CANCELLED')) {
      throw new BadRequestException('Esta troca não está mais disponível.')
    }

    const actor = { actorType: 'CUSTOMER', actorId: customerId }
    let accepted = 0
    let rejected = 0
    for (const decision of decisions) {
      await this.decideSuggestion(decision.id, decision.accept, context, actor, 'CUSTOMER')
      if (decision.accept) accepted++
      else rejected++
    }
    this.notificationsService
      .notifyPickingTeamSubstitutionAnswer(orderId, order.erpDav || orderId.slice(-8).toUpperCase(), accepted, rejected)
      .catch(() => {})
    return { accepted, rejected }
  }

  /** "Seguir sem as trocas": so depois do prazo de resposta. */
  async expireSuggestions(orderId: string, context: Partial<PickingTenantContext>, actor?: PickingActor) {
    const order = await this.findOrderForPicking(orderId, context)
    this.assertStillInPicking(order.status)
    const open = await this.prisma.substitutionSuggestion.findMany({ where: { orderId, status: 'PENDING', sentAt: { not: null } } })
    const remaining = this.replyMinutesLeft(open)
    if (remaining > 0) {
      throw new BadRequestException(`Ainda no prazo de resposta do cliente (faltam ${remaining} min). Registre a resposta ou espere.`)
    }
    await this.expireOpenSuggestions(orderId, actor)
    return this.findTaskByOrder(orderId, context)
  }

  /** Antes do caixa: nada sem enviar, nada dentro do prazo; o que passou do prazo expira. */
  private async settleSuggestionsBeforeCashier(orderId: string, actor?: PickingActor) {
    const open = await this.prisma.substitutionSuggestion.findMany({ where: { orderId, status: 'PENDING' } })
    if (!open.length) return
    if (open.some((s) => !s.sentAt)) {
      throw new BadRequestException('Há troca sugerida que não foi enviada ao cliente. Envie pelo WhatsApp ou apague a sugestão.')
    }
    const remaining = this.replyMinutesLeft(open)
    if (remaining > 0) {
      throw new BadRequestException(`Aguardando a resposta do cliente sobre as trocas (faltam ${remaining} min). Registre a resposta ou espere o prazo.`)
    }
    await this.expireOpenSuggestions(orderId, actor)
  }

  private replyMinutesLeft(open: Array<{ sentAt: Date | null }>) {
    const sent = open.map((s) => s.sentAt?.getTime() || 0).filter(Boolean)
    if (!sent.length) return 0
    const left = Math.max(...sent) + SUBSTITUTION_REPLY_MINUTES * 60000 - Date.now()
    return left > 0 ? Math.ceil(left / 60000) : 0
  }

  private async expireOpenSuggestions(orderId: string, actor?: PickingActor) {
    const result = await this.prisma.substitutionSuggestion.updateMany({
      where: { orderId, status: 'PENDING', sentAt: { not: null } },
      data: { status: 'EXPIRED', decidedAt: new Date(), decidedBy: 'SYSTEM' },
    })
    if (result.count > 0) {
      const order = await this.findOrderForPicking(orderId)
      await this.recordOrderEvent(order, 'order.substitution_expired', { count: result.count, minutes: SUBSTITUTION_REPLY_MINUTES }, actor)
    }
    await this.syncSubstitutionStatus(orderId)
  }

  /** Pedido e tarefa "aguardando o cliente" so enquanto houver troca enviada sem resposta. */
  private async syncSubstitutionStatus(orderId: string) {
    const [order, task, waiting] = await Promise.all([
      this.prisma.order.findUnique({ where: { id: orderId }, select: { status: true } }),
      this.prisma.pickingTask.findFirst({ where: { orderId }, select: { id: true, status: true } }),
      this.prisma.substitutionSuggestion.count({ where: { orderId, status: 'PENDING', sentAt: { not: null } } }),
    ])
    if (!order || PAST_CASHIER_STATUSES.includes(order.status)) return
    const orderStatus = waiting ? 'WAITING_CUSTOMER_SUBSTITUTION' : order.status === 'WAITING_CUSTOMER_SUBSTITUTION' ? 'PICKING' : order.status
    if (orderStatus !== order.status) {
      await this.prisma.order.update({ where: { id: orderId }, data: { status: orderStatus } })
    }
    if (task && ['IN_PROGRESS', 'WAITING_SUBSTITUTION'].includes(task.status)) {
      const taskStatus = waiting ? 'WAITING_SUBSTITUTION' : 'IN_PROGRESS'
      if (taskStatus !== task.status) await this.prisma.pickingTask.update({ where: { id: task.id }, data: { status: taskStatus } })
    }
  }

  private async findSuggestion(id: string, context: Partial<PickingTenantContext>) {
    const suggestion = await this.prisma.substitutionSuggestion.findFirst({ where: { id, ...tenantStoreWhere(context) } })
    if (!suggestion) throw new NotFoundException('Troca sugerida não encontrada.')
    return suggestion
  }

  private async findTaskByOrder(orderId: string, context: Partial<PickingTenantContext>) {
    const task = await this.prisma.pickingTask.findFirst({ where: { orderId, ...tenantStoreWhere(context) }, select: { id: true } })
    if (!task) throw new NotFoundException('Separação não encontrada.')
    return this.findTask(task.id, context)
  }

  async addItemToOrder(
    orderId: string,
    dto: AddItemToOrderDto,
    context: Partial<PickingTenantContext>,
    actor?: PickingActor,
  ) {
    const order = await this.findOrderForPicking(orderId, context)
    this.assertStillInPicking(order.status)

    const product = await this.prisma.product.findFirst({
      where: { id: dto.productId, tenantId: order.tenantId, storeId: order.storeId, active: true },
    })
    if (!product) throw new NotFoundException('Produto nao encontrado.')

    const unitPrice = product.promotionalPrice ?? product.price
    const subtotal = this.roundMoney(unitPrice * dto.quantity)

    const orderItem = await this.prisma.orderItem.create({
      data: {
        tenantId: order.tenantId,
        storeId: order.storeId,
        orderId: order.id,
        productId: product.id,
        quantity: dto.quantity,
        unitPrice,
        subtotal,
        requestedQuantity: this.decimal3(dto.quantity),
        fulfilledQuantity: this.decimal3(dto.quantity),
        finalUnitPrice: this.decimal2(unitPrice),
        finalSubtotal: this.decimal2(subtotal),
        status: 'PICKED',
        pickerNotes: dto.notes || 'Incluido durante separacao',
        addedByPicker: true,
      },
      include: { product: true },
    })

    const task = await this.prisma.pickingTask.findFirst({
      where: { orderId, ...tenantStoreWhere(context) },
    })
    if (task) {
      await this.prisma.pickingTaskItem.create({
        data: {
          tenantId: order.tenantId,
          storeId: order.storeId,
          taskId: task.id,
          orderItemId: orderItem.id,
          productId: product.id,
          requestedQuantity: this.decimal3(dto.quantity),
          pickedQuantity: this.decimal3(dto.quantity),
          status: 'PICKED',
          notes: dto.notes || 'Incluido durante separacao',
        },
      })
    }

    const recalculated = await this.recalculateOrderTotals(order.id)
    await this.recordOrderEvent(recalculated, 'order.item_added_by_picker', {
      taskId: task?.id || null,
      orderItemId: orderItem.id,
      productId: product.id,
      productName: product.name,
      quantity: dto.quantity,
      unitPrice,
      subtotal,
      notes: dto.notes || null,
    }, actor)

    if (task) return this.findTask(task.id, context)
    return recalculated
  }

  async resetPickedItem(
    taskId: string,
    taskItemId: string,
    dto: ResetPickedItemDto,
    context: Partial<PickingTenantContext>,
    actor?: PickingActor,
  ) {
    const task = await this.findTaskForOperation(taskId, context)
    await this.assertOrderStillInPicking(task.orderId)
    const taskItem = this.getTaskItem(task, taskItemId)

    if (!FINAL_ITEM_STATUSES.includes(taskItem.status)) {
      throw new BadRequestException('Item ainda nao foi separado.')
    }
    // Troca aceita: reabrir o original deixaria o substituto no pedido em dobro.
    if (taskItem.status === 'SUBSTITUTED') {
      throw new BadRequestException('Este item foi trocado com o aceite do cliente e não pode ser reaberto.')
    }

    const orderItem = await this.findOrderItemForTask(task, taskItem.orderItemId)
    const previousStatus = taskItem.status
    const previousQty = this.numberValue(taskItem.pickedQuantity)

    await Promise.all([
      this.prisma.pickingTaskItem.update({
        where: { id: taskItem.id },
        data: { status: 'PENDING', pickedQuantity: null, finalWeight: null, barcode: null, notes: null },
      }),
      this.prisma.orderItem.update({
        where: { id: orderItem.id },
        data: { status: 'ACTIVE', fulfilledQuantity: null, finalSubtotal: null, pickerNotes: null, cutReason: null, pickMethod: null, pickedBarcode: null },
      }),
      this.prisma.pickingTask.update({
        where: { id: task.id },
        data: { status: 'IN_PROGRESS', completedAt: null },
      }),
    ])

    await this.recalculateOrderTotals(task.orderId)
    await this.prisma.order.update({
      where: { id: task.orderId },
      data: { status: 'PICKING' },
    })
    // Item reaberto (o separador achou o produto): a troca sugerida para ele cai.
    await this.prisma.substitutionSuggestion.updateMany({
      where: { orderItemId: orderItem.id, status: 'PENDING' },
      data: { status: 'CANCELLED', decidedAt: new Date(), decidedBy: 'PICKER' },
    })
    await this.syncSubstitutionStatus(task.orderId)

    const order = await this.findOrderForPicking(task.orderId, context)
    await this.recordOrderEvent(order, 'order.item_reset_by_picker', {
      taskId: task.id,
      taskItemId: taskItem.id,
      orderItemId: orderItem.id,
      productId: orderItem.productId,
      productName: orderItem.product?.name || null,
      previousStatus,
      previousQuantity: previousQty,
      reason: dto.reason || null,
    }, actor)

    return this.findTask(task.id, context)
  }

  async removeAddedItem(
    taskId: string,
    taskItemId: string,
    context: Partial<PickingTenantContext>,
    actor?: PickingActor,
  ) {
    const task = await this.findTaskForOperation(taskId, context)
    await this.assertOrderStillInPicking(task.orderId)
    const taskItem = this.getTaskItem(task, taskItemId)
    const orderItem = await this.findOrderItemForTask(task, taskItem.orderItemId)

    if (!orderItem.pickerNotes?.includes('Incluido durante separacao')) {
      throw new BadRequestException('Somente itens incluidos durante separacao podem ser removidos.')
    }

    await Promise.all([
      this.prisma.pickingTaskItem.delete({ where: { id: taskItem.id } }),
      this.prisma.orderItem.delete({ where: { id: orderItem.id } }),
    ])

    const recalculated = await this.recalculateOrderTotals(task.orderId)
    await this.recordOrderEvent(recalculated, 'order.added_item_removed', {
      taskId: task.id,
      taskItemId: taskItem.id,
      orderItemId: orderItem.id,
      productId: orderItem.productId,
      productName: orderItem.product?.name || null,
    }, actor)

    return this.findTask(task.id, context)
  }

  async cancelTask(id: string, context: Partial<PickingTenantContext>, _actor?: PickingActor) {
    const task = await this.findTaskForOperation(id, context)
    if (['COMPLETED', 'CANCELLED'].includes(task.status)) {
      throw new BadRequestException('Tarefa ja esta encerrada.')
    }
    const updated = await this.prisma.pickingTask.update({
      where: { id: task.id },
      data: { status: 'CANCELLED' },
      include: { items: true },
    })
    const [detailed] = await this.attachTaskDetails([updated], context)
    return detailed
  }

  async finishTask(id: string, dto: FinishPickingTaskDto, context: Partial<PickingTenantContext>, actor?: PickingActor) {
    const task = await this.findTaskForOperation(id, context)
    const pendingItems = task.items.filter((item) => !FINAL_ITEM_STATUSES.includes(item.status))
    if (pendingItems.length > 0) {
      throw new BadRequestException('Ainda existem itens pendentes de separacao.')
    }

    const missingWithoutReason = task.items.filter((item) => item.status === 'MISSING' && !String(item.notes || '').trim())
    if (missingWithoutReason.length > 0) {
      throw new BadRequestException('Itens faltantes exigem justificativa antes da conferencia.')
    }

    const completedAt = new Date()
    const updated = await this.prisma.pickingTask.update({
      where: { id: task.id },
      data: { status: 'CONFERENCE_PENDING', completedAt },
      include: { items: true },
    })
    const order = await this.prisma.order.update({
      where: { id: task.orderId },
      data: { status: 'CONFERENCE_PENDING' },
      include: {
        customer: { select: CUSTOMER_SAFE_SELECT },
        items: { include: { product: true } },
      },
    })
    await this.recalculateOrderTotals(task.orderId)
    await this.recordOrderEvent(order, 'order.picking_completed', {
      taskId: task.id,
      completedAt: completedAt.toISOString(),
      notes: dto.notes || null,
      totalItems: task.items.length,
      missingItems: task.items.filter((item) => item.status === 'MISSING').length,
      substitutions: task.items.filter((item) => item.status === 'SUBSTITUTED').length,
    }, actor)

    this.notificationsService.notifyOrderStatusChange(task.orderId, 'CONFERENCE_PENDING').catch(() => {})

    const [detailed] = await this.attachTaskDetails([updated], context)
    return detailed
  }

  async conferenceTask(
    id: string,
    dto: ConferencePickingTaskDto,
    context: Partial<PickingTenantContext>,
    actor?: PickingActor,
  ) {
    const task = await this.findTaskForOperation(id, context)
    const pendingItems = task.items.filter((item) => !FINAL_ITEM_STATUSES.includes(item.status))
    if (pendingItems.length > 0) {
      throw new BadRequestException('Conferencia bloqueada: existem itens sem separacao finalizada.')
    }

    const divergences = task.items.filter((item) => this.hasPickingDivergence(item))
    if (divergences.length > 0 && !String(dto.justification || '').trim()) {
      throw new BadRequestException('Conferencia com divergencia exige justificativa.')
    }

    const order = await this.findOrderForPicking(task.orderId, context)
    const checklistItems = this.buildChecklistItems(task, order)
    const checklist = await this.prisma.packingChecklist.create({
      data: {
        tenantId: task.tenantId,
        storeId: task.storeId,
        orderId: task.orderId,
        taskId: task.id,
        status: 'PENDING',
        items: this.toJsonPayload(checklistItems),
        checkedById: actor?.actorId || null,
        notes: dto.notes || dto.justification || null,
      },
    })

    const updatedTask = await this.prisma.pickingTask.update({
      where: { id: task.id },
      data: { status: 'PACKING' },
      include: { items: true },
    })
    const updatedOrder = await this.prisma.order.update({
      where: { id: task.orderId },
      data: { status: 'PACKING' },
      include: {
        customer: { select: CUSTOMER_SAFE_SELECT },
        items: { include: { product: true } },
      },
    })
    await this.recordOrderEvent(updatedOrder, 'order.conference_completed', {
      taskId: task.id,
      checklistId: checklist.id,
      divergences: divergences.map((item) => ({
        taskItemId: item.id,
        orderItemId: item.orderItemId,
        requestedQuantity: this.numberValue(item.requestedQuantity),
        pickedQuantity: this.numberValue(item.finalWeight) ?? this.numberValue(item.pickedQuantity),
        status: item.status,
      })),
      justification: dto.justification || null,
    }, actor)

    const [detailed] = await this.attachTaskDetails([updatedTask], context)
    return detailed
  }

  async completePackingChecklist(
    id: string,
    dto: PackingChecklistDto,
    context: Partial<PickingTenantContext>,
    actor?: PickingActor,
  ) {
    const task = await this.findTaskForOperation(id, context)
    if (task.status !== 'PACKING') {
      throw new BadRequestException('Checklist de embalagem exige tarefa em empacotamento.')
    }

    const order = await this.findOrderForPicking(task.orderId, context)
    const checklistItems = dto.items && dto.items.length > 0 ? dto.items : this.buildChecklistItems(task, order)
    const existingChecklist = await this.prisma.packingChecklist.findFirst({
      where: { tenantId: task.tenantId, storeId: task.storeId, taskId: task.id },
      orderBy: { createdAt: 'desc' },
    })

    const checklist = existingChecklist
      ? await this.prisma.packingChecklist.update({
          where: { id: existingChecklist.id },
          data: {
            status: 'CHECKED',
            items: this.toJsonPayload(checklistItems),
            checkedById: actor?.actorId || existingChecklist.checkedById,
            notes: dto.notes || existingChecklist.notes,
          },
        })
      : await this.prisma.packingChecklist.create({
          data: {
            tenantId: task.tenantId,
            storeId: task.storeId,
            orderId: task.orderId,
            taskId: task.id,
            status: 'CHECKED',
            items: this.toJsonPayload(checklistItems),
            checkedById: actor?.actorId || null,
            notes: dto.notes || null,
          },
        })

    const completedAt = new Date()
    const updatedTask = await this.prisma.pickingTask.update({
      where: { id: task.id },
      data: { status: 'COMPLETED', completedAt: task.completedAt || completedAt },
      include: { items: true },
    })
    const readyStatus = order.fulfillmentType === 'PICKUP' ? 'READY_FOR_PICKUP' : 'READY_FOR_DELIVERY'
    const updatedOrder = await this.prisma.order.update({
      where: { id: task.orderId },
      data: { status: readyStatus },
      include: {
        customer: { select: CUSTOMER_SAFE_SELECT },
        items: { include: { product: true } },
      },
    })
    await this.recordOrderEvent(updatedOrder, 'order.packing_completed', {
      taskId: task.id,
      checklistId: checklist.id,
      status: readyStatus,
      notes: dto.notes || null,
      metadata: dto.metadata || {},
    }, actor)
    await this.recordPerformanceSnapshot(updatedTask)

    this.notificationsService.notifyOrderStatusChange(task.orderId, readyStatus).catch(() => {})

    const [detailed] = await this.attachTaskDetails([updatedTask], context)
    return detailed
  }

  /**
   * Acompanhamento da separacao para o admin (29/09/2026): quem esta separando
   * o que, ha quanto tempo, o que espera separador e o que espera o cliente,
   * mais o desempenho por separador. A separacao em si acontece no app.
   */
  async getSupervision(context: Partial<PickingTenantContext>, period: 'day' | 'week' = 'day') {
    const scoped = tenantStoreWhere(context)
    const now = new Date()
    const brtMidnight = (() => {
      const local = new Date(now.getTime() - 3 * 3600_000)
      return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) + 3 * 3600_000)
    })()
    const from = period === 'week' ? new Date(brtMidnight.getTime() - 6 * 86400_000) : brtMidnight
    const minutesSince = (d?: Date | null) => (d ? Math.round((now.getTime() - d.getTime()) / 60000) : 0)
    const code = (id: string) => id.slice(-8).toUpperCase()

    const staff = await this.prisma.admin.findMany({ where: { active: true }, select: { id: true, name: true, moduleAccess: true, role: true } })
    const nameOf = new Map(staff.map((a) => [a.id, a.name]))

    // Em separacao: tarefas abertas de pedidos ainda no fluxo.
    const openTasks = await this.prisma.pickingTask.findMany({
      where: { ...scoped, status: { in: ['PENDING', 'IN_PROGRESS', 'WAITING_SUBSTITUTION'] } },
      include: { items: { select: { status: true } } },
    })
    const taskOrders = new Map(
      (
        await this.prisma.order.findMany({
          where: { id: { in: openTasks.map((t) => t.orderId) } },
          select: { id: true, status: true, erpDav: true, scheduledFor: true, customer: { select: { name: true } } },
        })
      ).map((o) => [o.id, o]),
    )
    const picking = openTasks
      .filter((t) => {
        const o = taskOrders.get(t.orderId)
        return o && !['CANCELLED', 'REFUNDED', 'COMPLETED', 'DELIVERED'].includes(o.status)
      })
      .map((t) => {
        const o = taskOrders.get(t.orderId)!
        const done = t.items.filter((i) => FINAL_ITEM_STATUSES.includes(i.status)).length
        const minutes = minutesSince(t.startedAt || t.createdAt)
        return {
          taskId: t.id,
          orderId: t.orderId,
          code: code(t.orderId),
          dav: o.erpDav,
          customer: o.customer?.name || '',
          pickerId: t.assignedToId,
          picker: t.assignedToId ? nameOf.get(t.assignedToId) || 'desconhecido' : null,
          waitingCustomer: o.status === 'WAITING_CUSTOMER_SUBSTITUTION' || t.status === 'WAITING_SUBSTITUTION',
          minutes,
          late: minutes >= 45,
          itemsDone: done,
          itemsTotal: t.items.length,
          missing: t.items.filter((i) => i.status === 'MISSING').length,
          substituted: t.items.filter((i) => i.status === 'SUBSTITUTED').length,
        }
      })
      .sort((a, b) => b.minutes - a.minutes)

    // Esperando separador: pedido confirmado sem ninguem separando (agendado para mais de 1 h fica de fora).
    const inPicking = new Set(picking.map((p) => p.orderId))
    const waitingOrders = await this.prisma.order.findMany({
      where: { ...scoped, status: { in: ['PENDING', 'CONFIRMED', 'PICKING_PENDING'] } },
      select: { id: true, erpDav: true, createdAt: true, scheduledFor: true, customer: { select: { name: true } }, _count: { select: { items: true } } },
      orderBy: { createdAt: 'asc' },
    })
    const waiting = waitingOrders
      .filter((o) => !inPicking.has(o.id) && !(o.scheduledFor && o.scheduledFor.getTime() - now.getTime() > 3600_000))
      .map((o) => {
        const minutes = minutesSince(o.createdAt)
        return { orderId: o.id, code: code(o.id), dav: o.erpDav, customer: o.customer?.name || '', minutes, late: minutes >= 15, items: o._count.items }
      })

    const sentToCashier = await this.prisma.orderEvent.count({ where: { ...scoped, type: 'order.sent_to_cashier', createdAt: { gte: brtMidnight } } })

    // Desempenho: tarefas concluidas no periodo.
    const done = await this.prisma.pickingTask.findMany({
      where: { ...scoped, status: 'COMPLETED', completedAt: { gte: from } },
      include: { items: { select: { status: true } } },
    })
    const perf = new Map<string, { orders: number; minutes: number; timed: number; items: number; missing: number }>()
    for (const t of done) {
      const key = t.assignedToId || 'sem-separador'
      const e = perf.get(key) || { orders: 0, minutes: 0, timed: 0, items: 0, missing: 0 }
      e.orders += 1
      if (t.startedAt && t.completedAt) {
        e.minutes += (t.completedAt.getTime() - t.startedAt.getTime()) / 60000
        e.timed += 1
      }
      e.items += t.items.length
      e.missing += t.items.filter((i) => i.status === 'MISSING').length
      perf.set(key, e)
    }
    const team = [...perf.entries()]
      .map(([id, e]) => ({
        pickerId: id,
        picker: id === 'sem-separador' ? 'Sem separador' : nameOf.get(id) || 'desconhecido',
        orders: e.orders,
        avgMinutes: e.timed ? Math.round(e.minutes / e.timed) : null,
        items: e.items,
        missingRate: e.items ? Math.round((e.missing / e.items) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.orders - a.orders)

    const pickers = staff
      .filter((a) => a.role !== 'customer' && (a.role === 'picker' || (a.moduleAccess || []).includes('picking')))
      .map((a) => ({ id: a.id, name: a.name }))

    return { generatedAt: now.toISOString(), period, waiting, picking, sentToCashier, team, pickers }
  }

  async getPerformance(context: Partial<PickingTenantContext>, filters: { from?: string; to?: string } = {}) {
    const { from, to } = resolveDateRange(filters, 7)
    const scopedWhere = tenantStoreWhere(context)
    const tasks = await this.prisma.pickingTask.findMany({
      where: {
        ...scopedWhere,
        createdAt: { gte: from, lte: to },
      },
      include: { items: true },
      orderBy: { createdAt: 'asc' },
    })
    const snapshots = await this.prisma.pickerPerformanceSnapshot.findMany({
      where: {
        ...scopedWhere,
        periodStart: { gte: from },
        periodEnd: { lte: to },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    const byPicker = new Map<string, {
      pickerId: string
      tasksCompleted: number
      itemsPicked: number
      itemsMissing: number
      substitutions: number
      pickingSeconds: number
      startDelaySeconds: number
      startedTasks: number
      itemsPerMinute: number
    }>()
    const delayedByStage = new Map<string, number>()
    const now = new Date()

    for (const task of tasks) {
      const pickerId = task.assignedToId || 'unassigned'
      if (!byPicker.has(pickerId)) {
        byPicker.set(pickerId, {
          pickerId,
          tasksCompleted: 0,
          itemsPicked: 0,
          itemsMissing: 0,
          substitutions: 0,
          pickingSeconds: 0,
          startDelaySeconds: 0,
          startedTasks: 0,
          itemsPerMinute: 0,
        })
      }
      const bucket = byPicker.get(pickerId)!
      const picked = task.items.filter((item) => item.status === 'PICKED').length
      const missing = task.items.filter((item) => item.status === 'MISSING').length
      const substitutions = task.items.filter((item) => item.status === 'SUBSTITUTED').length
      bucket.itemsPicked += picked
      bucket.itemsMissing += missing
      bucket.substitutions += substitutions

      if (task.startedAt) {
        bucket.startedTasks += 1
        bucket.startDelaySeconds += Math.max(0, Math.round((task.startedAt.getTime() - task.createdAt.getTime()) / 1000))
      }
      if (task.startedAt && task.completedAt) {
        bucket.tasksCompleted += 1
        bucket.pickingSeconds += Math.max(0, Math.round((task.completedAt.getTime() - task.startedAt.getTime()) / 1000))
      }
      if (task.slaDueAt && task.slaDueAt < now && !['COMPLETED', 'CANCELLED'].includes(task.status)) {
        delayedByStage.set(task.status, (delayedByStage.get(task.status) || 0) + 1)
      }
    }

    const pickers = Array.from(byPicker.values()).map((bucket) => ({
      ...bucket,
      avgStartDelaySeconds: bucket.startedTasks > 0 ? Math.round(bucket.startDelaySeconds / bucket.startedTasks) : 0,
      itemsPerMinute: bucket.pickingSeconds > 0
        ? Number((bucket.itemsPicked / (bucket.pickingSeconds / 60)).toFixed(2))
        : 0,
    }))

    return {
      period: { from: from.toISOString(), to: to.toISOString() },
      totals: {
        tasks: tasks.length,
        completed: tasks.filter((task) => task.status === 'COMPLETED').length,
        delayed: Array.from(delayedByStage.values()).reduce((sum, count) => sum + count, 0),
      },
      delayedByStage: Object.fromEntries(delayedByStage),
      pickers,
      snapshots,
    }
  }

  private async attachTaskDetails(tasks: PickingTaskWithItems[], context: Partial<PickingTenantContext>) {
    if (tasks.length === 0) return []
    const scopedWhere = tenantStoreWhere(context)
    const orderIds = Array.from(new Set(tasks.map((task) => task.orderId)))
    const taskIds = tasks.map((task) => task.id)
    const assigneeIds = Array.from(new Set(tasks.map((task) => task.assignedToId).filter((id): id is string => Boolean(id))))
    const [orders, checklists, assignees, suggestions] = await Promise.all([
      this.prisma.order.findMany({
        where: { ...scopedWhere, id: { in: orderIds } },
        include: {
          customer: { select: CUSTOMER_SAFE_SELECT },
          items: { include: { product: true } },
        },
      }),
      this.prisma.packingChecklist.findMany({
        where: { ...scopedWhere, taskId: { in: taskIds } },
        orderBy: { createdAt: 'desc' },
      }),
      // Nome de quem esta separando: o app mostra "em separacao por X" e
      // oferece assumir, em vez de so recusar a acao com erro.
      assigneeIds.length
        ? this.prisma.admin.findMany({ where: { id: { in: assigneeIds } }, select: { id: true, name: true } })
        : Promise.resolve([] as Array<{ id: string; name: string }>),
      this.prisma.substitutionSuggestion.findMany({
        where: { orderId: { in: orderIds }, status: { not: 'CANCELLED' } },
        orderBy: { createdAt: 'asc' },
      }),
    ])
    const assigneeNameById = new Map(assignees.map((admin) => [admin.id, admin.name]))
    const suggestedProducts = suggestions.length
      ? await this.prisma.product.findMany({
          where: { id: { in: Array.from(new Set(suggestions.map((s) => s.productId))) } },
          select: { id: true, name: true, ean: true, unit: true, isFractional: true, price: true, promotionalPrice: true },
        })
      : []
    const productById = new Map(suggestedProducts.map((p) => [p.id, p]))
    const suggestionsByOrder = new Map<string, Array<Record<string, unknown>>>()
    for (const s of suggestions) {
      const list = suggestionsByOrder.get(s.orderId) || []
      list.push({ ...s, quantity: Number(s.quantity), unitPrice: Number(s.unitPrice), product: productById.get(s.productId) || null })
      suggestionsByOrder.set(s.orderId, list)
    }

    const ordersById = new Map(orders.map((order) => [order.id, order]))
    const checklistByTaskId = new Map<string, typeof checklists[number]>()
    for (const checklist of checklists) {
      if (checklist.taskId && !checklistByTaskId.has(checklist.taskId)) {
        checklistByTaskId.set(checklist.taskId, checklist)
      }
    }

    return tasks.map((task) => ({
      ...task,
      order: ordersById.has(task.orderId)
        ? { ...ordersById.get(task.orderId)!, substitutionSuggestions: suggestionsByOrder.get(task.orderId) || [] }
        : null,
      checklist: checklistByTaskId.get(task.id) || null,
      assignedToName: task.assignedToId ? assigneeNameById.get(task.assignedToId) || null : null,
    }))
  }

  private async findTaskForOperation(id: string, context: Partial<PickingTenantContext>) {
    const task = await this.prisma.pickingTask.findFirst({
      where: { id, ...tenantStoreWhere(context) },
      include: { items: true },
    })
    if (!task) throw new NotFoundException('Tarefa de separacao nao encontrada.')
    return task
  }

  private async findOrderForPicking(id: string, context?: Partial<PickingTenantContext>): Promise<OrderForPicking> {
    const order = await this.prisma.order.findFirst({
      where: { id, ...tenantStoreWhere(context) },
      include: {
        customer: { select: CUSTOMER_SAFE_SELECT },
        items: { include: { product: true } },
      },
    })
    if (!order) throw new NotFoundException('Pedido nao encontrado.')
    return order
  }

  private async findOrderItemForTask(task: PickingTaskWithItems, orderItemId: string) {
    const orderItem = await this.prisma.orderItem.findFirst({
      where: {
        id: orderItemId,
        orderId: task.orderId,
        tenantId: task.tenantId,
        storeId: task.storeId,
      },
      include: { product: true },
    })
    if (!orderItem) throw new NotFoundException('Item do pedido nao encontrado.')
    return orderItem
  }

  private getTaskItem(task: PickingTaskWithItems, taskItemId: string) {
    const item = task.items.find((candidate) => candidate.id === taskItemId)
    if (!item) throw new NotFoundException('Item da tarefa de separacao nao encontrado.')
    return item
  }

  private assertStillInPicking(status: string) {
    if (PAST_CASHIER_STATUSES.includes(status)) {
      throw new BadRequestException('Este pedido já foi enviado ao caixa. A separação não pode mais ser alterada.')
    }
  }

  private async assertOrderStillInPicking(orderId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId }, select: { status: true } })
    if (order) this.assertStillInPicking(order.status)
  }

  private async ensureTaskCanReceiveItems(taskId: string, context: Partial<PickingTenantContext>, actor?: PickingActor) {
    let task = await this.findTaskForOperation(taskId, context)
    // 08/10/2026: WAITING_SUBSTITUTION tambem passava por startTask, que volta
    // o pedido para PICKING e manda ao cliente "pedido sendo separado" de novo
    // -- no meio da espera pela resposta dele. A tarefa ja esta em andamento.
    if (task.status === 'PENDING') {
      await this.startTask(task.id, context, actor)
      task = await this.findTaskForOperation(taskId, context)
    }
    if (!['IN_PROGRESS', 'WAITING_SUBSTITUTION'].includes(task.status)) {
      throw new BadRequestException('Tarefa nao esta em separacao.')
    }
    // JON-73 (Auditoria 360, Medium): startTask ja recusa um segundo
    // separador pra tarefa PENDING (claim atomico acima), mas uma tarefa
    // JA IN_PROGRESS chegava aqui sem checar de quem era -- outro separador
    // conseguia separar/reportar falta em item de tarefa que nao era dele.
    // Admin (actorType ADMIN) segue sem restricao, igual ao resto do modulo.
    // O cliente aceitando a troca pelo site (08/10/2026) mexe na tarefa do
    // separador por definicao: nao e "outro membro da equipe".
    const isAdminActor = ['ADMIN', 'CUSTOMER'].includes(String(actor?.actorType || '').toUpperCase())
    if (!isAdminActor && task.assignedToId && actor?.actorId && task.assignedToId !== actor.actorId) {
      throw new BadRequestException('Pedido esta sendo separado por outro membro da equipe.')
    }
    return task
  }

  private async recalculateOrderTotals(orderId: string): Promise<OrderForPicking> {
    const order = await this.findOrderForPicking(orderId)
    const items = await this.prisma.orderItem.findMany({
      where: { orderId },
      include: { product: true },
    })
    const subtotal = items.reduce((sum, item) => {
      if (['CANCELLED', 'SUBSTITUTED'].includes(item.status)) return sum
      return sum + (this.numberValue(item.finalSubtotal) ?? item.subtotal)
    }, 0)
    const roundedSubtotal = this.roundMoney(subtotal)
    const total = this.roundMoney(roundedSubtotal + order.delivery - order.discount)

    return this.prisma.order.update({
      where: { id: orderId },
      data: {
        subtotal: roundedSubtotal,
        total,
      },
      include: {
        customer: { select: CUSTOMER_SAFE_SELECT },
        items: { include: { product: true } },
      },
    })
  }

  private async recordOrderEvent(
    order: Pick<OrderForPicking, 'id' | 'tenantId' | 'storeId' | 'status' | 'paymentStatus'>,
    type: string,
    payload: Record<string, unknown>,
    actor?: PickingActor,
  ) {
    return this.prisma.orderEvent.create({
      data: {
        tenantId: order.tenantId || DEFAULT_TENANT_ID,
        storeId: order.storeId || DEFAULT_STORE_ID,
        orderId: order.id,
        type,
        payload: this.toJsonPayload(payload),
        actorType: actor?.actorType || 'SYSTEM',
        actorId: actor?.actorId || null,
      },
    })
  }

  private async findSubstitutionSuggestions(orderItem: Awaited<ReturnType<PickingService['findOrderItemForTask']>>) {
    const master = await this.prisma.productMaster.findFirst({
      where: {
        tenantId: orderItem.tenantId,
        legacyProductId: orderItem.productId,
      },
    })
    if (!master) return []

    const links = await this.prisma.productSubstitution.findMany({
      where: { productId: master.id, status: 'ACTIVE' },
      include: { substitute: true },
      orderBy: { priority: 'asc' },
      take: 5,
    })
    const legacyIds = links
      .map((link) => link.substitute.legacyProductId)
      .filter((value): value is string => Boolean(value))
    if (legacyIds.length === 0) return []

    return this.prisma.product.findMany({
      where: {
        id: { in: legacyIds },
        tenantId: orderItem.tenantId,
        storeId: orderItem.storeId,
        active: true,
      },
      take: 5,
    })
  }

  private buildChecklistItems(task: PickingTaskWithItems, order: OrderForPicking) {
    const orderItemsById = new Map(order.items.map((item) => [item.id, item]))
    return task.items.map((item) => {
      const orderItem = orderItemsById.get(item.orderItemId)
      return {
        taskItemId: item.id,
        orderItemId: item.orderItemId,
        productId: item.productId,
        productName: orderItem?.product?.name || null,
        ean: orderItem?.product?.ean || null,
        requestedQuantity: this.numberValue(item.requestedQuantity),
        pickedQuantity: this.numberValue(item.pickedQuantity),
        finalWeight: this.numberValue(item.finalWeight),
        status: item.status,
        notes: item.notes || orderItem?.pickerNotes || orderItem?.cutReason || null,
      }
    })
  }

  private hasPickingDivergence(item: PickingTaskWithItems['items'][number]) {
    if (['MISSING', 'SUBSTITUTED', 'CANCELLED'].includes(item.status)) return true
    const requested = this.numberValue(item.requestedQuantity) ?? 0
    const picked = this.numberValue(item.finalWeight) ?? this.numberValue(item.pickedQuantity) ?? 0
    return Math.abs(requested - picked) > 0.0009
  }

  private async recordPerformanceSnapshot(task: PickingTaskWithItems) {
    const pickerId = task.assignedToId || 'unassigned'
    const startedAt = task.startedAt || task.createdAt
    const completedAt = task.completedAt || new Date()
    const pickingSeconds = Math.max(0, Math.round((completedAt.getTime() - startedAt.getTime()) / 1000))
    const itemsPicked = task.items.filter((item) => item.status === 'PICKED').length
    const itemsMissing = task.items.filter((item) => item.status === 'MISSING').length
    const substitutions = task.items.filter((item) => item.status === 'SUBSTITUTED').length
    const itemsPerMinute = pickingSeconds > 0 ? Number((itemsPicked / (pickingSeconds / 60)).toFixed(2)) : 0

    return this.prisma.pickerPerformanceSnapshot.create({
      data: {
        tenantId: task.tenantId,
        storeId: task.storeId,
        pickerId,
        periodStart: startedAt,
        periodEnd: completedAt,
        tasksCompleted: 1,
        itemsPicked,
        itemsMissing,
        substitutions,
        pickingSeconds,
        itemsPerMinute: this.decimal2(itemsPerMinute),
      },
    })
  }

  private defaultSlaDueAt(createdAt: Date) {
    return new Date(createdAt.getTime() + 90 * 60 * 1000)
  }

  private priorityForSla(slaDueAt: Date) {
    const minutesUntilDue = Math.round((slaDueAt.getTime() - Date.now()) / 60000)
    if (minutesUntilDue <= 15) return 100
    if (minutesUntilDue <= 45) return 60
    return 20
  }

  private toJsonPayload(payload: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(payload ?? {})) as Prisma.InputJsonValue
  }

  private decimal3(value: number) {
    return new Prisma.Decimal(Number(value || 0).toFixed(3))
  }

  private decimal2(value: number) {
    return new Prisma.Decimal(this.roundMoney(value).toFixed(2))
  }

  private roundMoney(value: number) {
    return Number(Number(value || 0).toFixed(2))
  }

  private numberValue(value: Prisma.Decimal | number | string | null | undefined) {
    if (value === null || value === undefined) return undefined
    const numberValue = Number(value)
    return Number.isFinite(numberValue) ? numberValue : undefined
  }
}
