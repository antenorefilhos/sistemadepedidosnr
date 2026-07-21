import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../../common/prisma.service'
import { DEFAULT_STORE_ID, DEFAULT_TENANT_ID } from '../../common/tenant/tenant.constants'
import { TenantContext, tenantStoreWhere } from '../../common/tenant/tenant-context'
import {
  ConferencePickingTaskDto,
  CreatePickingTaskDto,
  FinishPickingTaskDto,
  MissingPickingItemDto,
  PackingChecklistDto,
  PickPickingItemDto,
  SubstitutePickingItemDto,
} from './dto/picking.dto'

type PickingTenantContext = Pick<TenantContext, 'tenantId' | 'storeId'>

type PickingActor = {
  actorType?: string
  actorId?: string
}

type PickingTaskWithItems = Prisma.PickingTaskGetPayload<{
  include: { items: true }
}>

type OrderForPicking = Prisma.OrderGetPayload<{
  include: { customer: true; items: { include: { product: true } } }
}>

const FINAL_ITEM_STATUSES = ['PICKED', 'MISSING', 'SUBSTITUTED', 'CANCELLED']

@Injectable()
export class PickingService {
  constructor(private readonly prisma: PrismaService) {}

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
        customer: true,
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
        customer: true,
        items: { include: { product: true } },
      },
    })
    await this.recordOrderEvent(updatedOrder, 'order.picking_task_created', {
      taskId: task.id,
      assignedToId: task.assignedToId,
      slaDueAt: task.slaDueAt?.toISOString() || null,
      itemCount: task.items.length,
    }, actor)

    const [detailed] = await this.attachTaskDetails([task], context)
    return detailed
  }

  async assignTask(id: string, pickerId: string, context: Partial<PickingTenantContext>, actor?: PickingActor) {
    const task = await this.findTaskForOperation(id, context)
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

    const startedAt = task.startedAt || new Date()
    const assignedToId = task.assignedToId || actor?.actorId || null
    const updated = await this.prisma.pickingTask.update({
      where: { id: task.id },
      data: {
        status: 'IN_PROGRESS',
        startedAt,
        assignedToId,
      },
      include: { items: true },
    })
    const order = await this.prisma.order.update({
      where: { id: task.orderId },
      data: { status: 'PICKING' },
      include: {
        customer: true,
        items: { include: { product: true } },
      },
    })
    await this.recordOrderEvent(order, 'order.picking_started', {
      taskId: task.id,
      assignedToId,
      startedAt: startedAt.toISOString(),
    }, actor)

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
      this.prisma.pickingTask.update({
        where: { id: task.id },
        data: { status: requestSubstitution ? 'WAITING_SUBSTITUTION' : 'IN_PROGRESS' },
      }),
    ])

    const order = await this.prisma.order.update({
      where: { id: task.orderId },
      data: { status: requestSubstitution ? 'WAITING_CUSTOMER_SUBSTITUTION' : 'PICKING' },
      include: {
        customer: true,
        items: { include: { product: true } },
      },
    })
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

    const unitPrice = substitute.promotionalPrice ?? substitute.price
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
        customer: true,
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
        customer: true,
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
        customer: true,
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

    const [detailed] = await this.attachTaskDetails([updatedTask], context)
    return detailed
  }

  async getPerformance(context: Partial<PickingTenantContext>, filters: { from?: string; to?: string } = {}) {
    const from = filters.from ? new Date(filters.from) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const to = filters.to ? new Date(filters.to) : new Date()
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
    const [orders, checklists] = await Promise.all([
      this.prisma.order.findMany({
        where: { ...scopedWhere, id: { in: orderIds } },
        include: {
          customer: true,
          items: { include: { product: true } },
        },
      }),
      this.prisma.packingChecklist.findMany({
        where: { ...scopedWhere, taskId: { in: taskIds } },
        orderBy: { createdAt: 'desc' },
      }),
    ])

    const ordersById = new Map(orders.map((order) => [order.id, order]))
    const checklistByTaskId = new Map<string, typeof checklists[number]>()
    for (const checklist of checklists) {
      if (checklist.taskId && !checklistByTaskId.has(checklist.taskId)) {
        checklistByTaskId.set(checklist.taskId, checklist)
      }
    }

    return tasks.map((task) => ({
      ...task,
      order: ordersById.get(task.orderId) || null,
      checklist: checklistByTaskId.get(task.id) || null,
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
        customer: true,
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

  private async ensureTaskCanReceiveItems(taskId: string, context: Partial<PickingTenantContext>, actor?: PickingActor) {
    let task = await this.findTaskForOperation(taskId, context)
    if (['PENDING', 'WAITING_SUBSTITUTION'].includes(task.status)) {
      await this.startTask(task.id, context, actor)
      task = await this.findTaskForOperation(taskId, context)
    }
    if (!['IN_PROGRESS', 'WAITING_SUBSTITUTION'].includes(task.status)) {
      throw new BadRequestException('Tarefa nao esta em separacao.')
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
        customer: true,
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
