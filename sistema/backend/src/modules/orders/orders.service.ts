import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { createHash, randomUUID } from 'crypto'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../../common/prisma.service'
import { WhatsAppDispatchResult, WhatsAppService } from '../../modules/notifications/whatsapp.service'
import { NotificationsService } from '../../modules/notifications/notifications.service'
import { InternalOrderContract } from '../integrations/dto/order-contract.dto'
import { IntegrationsService } from '../integrations/integrations.service'
import { OrderOrchestrationService } from '../integrations/order-orchestration.service'
import { CreateOrderDto } from './dto/create-order.dto'
import { UpdateOrderDto } from './dto/update-order.dto'
import { AuditLogService } from '../audit-log/audit-log.service'
import { DEFAULT_STORE_ID, DEFAULT_TENANT_ID } from '../../common/tenant/tenant.constants'
import { TenantContext, tenantStoreWhere } from '../../common/tenant/tenant-context'
import { InventoryService } from '../inventory/inventory.service'
import { PricingService } from '../pricing/pricing.service'
import { PublicApiService } from '../public-api/public-api.service'

type OrderWithRelations = Prisma.OrderGetPayload<{
  include: {
    customer: true
    items: { include: { product: true } }
  }
}>

export interface CreateOrderResult {
  order: OrderWithRelations
  whatsapp: WhatsAppDispatchResult | null
}

type OrderTenantContext = Pick<TenantContext, 'tenantId' | 'storeId'>

type OrderOmsActor = {
  actorType?: string
  actorId?: string
}

type AdminOrderFilters = {
  status?: string
  paymentStatus?: string
  customerId?: string
  limit?: number
}

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name)

  constructor(
    private prisma: PrismaService,
    private whatsappService: WhatsAppService,
    private auditLogService: AuditLogService,
    private orderOrchestrationService: OrderOrchestrationService,
    private integrationsService: IntegrationsService,
    private notificationsService: NotificationsService,
    private inventoryService: InventoryService,
    private pricingService: PricingService,
    private publicApiService: PublicApiService,
  ) {}

  async getSalesAnalytics(period: string) {
    const days = period === 'month' ? 30 : period === 'day' ? 1 : 7
    const start = new Date()
    start.setDate(start.getDate() - (days - 1))
    start.setHours(0, 0, 0, 0)

    const orders = await this.prisma.order.findMany({
      where: {
        createdAt: { gte: start },
      },
      select: {
        createdAt: true,
        total: true,
      },
      orderBy: { createdAt: 'asc' },
    })

    const byDay = new Map<string, { date: string; total: number; orders: number }>()

    for (let i = 0; i < days; i += 1) {
      const current = new Date(start)
      current.setDate(start.getDate() + i)
      const key = current.toISOString().slice(0, 10)
      byDay.set(key, { date: key, total: 0, orders: 0 })
    }

    for (const order of orders) {
      const key = order.createdAt.toISOString().slice(0, 10)
      const bucket = byDay.get(key)
      if (!bucket) continue

      bucket.total += order.total
      bucket.orders += 1
    }

    return {
      period,
      data: Array.from(byDay.values()),
    }
  }

  async getStatusAnalytics() {
    const grouped = await this.prisma.order.groupBy({
      by: ['status'],
      _count: {
        _all: true,
      },
    })

    const total = grouped.reduce((acc, item) => acc + item._count._all, 0)

    return {
      total,
      data: grouped.map((item) => ({
        status: item.status,
        count: item._count._all,
      })),
    }
  }

  async getRevenueAnalytics() {
    const now = new Date()

    const startToday = new Date(now)
    startToday.setHours(0, 0, 0, 0)

    const startYesterday = new Date(startToday)
    startYesterday.setDate(startYesterday.getDate() - 1)

    const startWeek = new Date(now)
    startWeek.setDate(startWeek.getDate() - 6)
    startWeek.setHours(0, 0, 0, 0)

    const startPrevWeek = new Date(startWeek)
    startPrevWeek.setDate(startPrevWeek.getDate() - 7)

    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const startPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)

    const endPrevMonth = new Date(startMonth)
    endPrevMonth.setMilliseconds(-1)

    const [todayAgg, yesterdayAgg, weekAgg, prevWeekAgg, monthAgg, prevMonthAgg] = await Promise.all([
      this.prisma.order.aggregate({ where: { createdAt: { gte: startToday } }, _sum: { total: true } }),
      this.prisma.order.aggregate({
        where: { createdAt: { gte: startYesterday, lt: startToday } },
        _sum: { total: true },
      }),
      this.prisma.order.aggregate({ where: { createdAt: { gte: startWeek } }, _sum: { total: true } }),
      this.prisma.order.aggregate({
        where: { createdAt: { gte: startPrevWeek, lt: startWeek } },
        _sum: { total: true },
      }),
      this.prisma.order.aggregate({ where: { createdAt: { gte: startMonth } }, _sum: { total: true } }),
      this.prisma.order.aggregate({
        where: { createdAt: { gte: startPrevMonth, lte: endPrevMonth } },
        _sum: { total: true },
      }),
    ])

    const today = todayAgg._sum.total || 0
    const yesterday = yesterdayAgg._sum.total || 0
    const week = weekAgg._sum.total || 0
    const prevWeek = prevWeekAgg._sum.total || 0
    const month = monthAgg._sum.total || 0
    const prevMonth = prevMonthAgg._sum.total || 0

    const percentage = (current: number, previous: number) => {
      if (previous === 0) {
        return current > 0 ? 100 : 0
      }
      return Number((((current - previous) / previous) * 100).toFixed(2))
    }

    return {
      today,
      week,
      month,
      delta: {
        todayVsYesterday: percentage(today, yesterday),
        weekVsPreviousWeek: percentage(week, prevWeek),
        monthVsPreviousMonth: percentage(month, prevMonth),
      },
    }
  }

  // ── Phase 17: Analytics Pro ─────────────────────────────────

  /**
   * Receita por categoria de produto
   */
  async getCategoryRevenue() {
    const items = await this.prisma.orderItem.findMany({
      include: { product: { select: { category: true } } },
    })

    const map = new Map<string, { revenue: number; orders: Set<string> }>()
    for (const item of items) {
      const cat = item.product?.category || 'GERAL'
      if (!map.has(cat)) map.set(cat, { revenue: 0, orders: new Set() })
      const bucket = map.get(cat)!
      bucket.revenue += item.subtotal
      bucket.orders.add(item.orderId)
    }

    return [...map.entries()]
      .map(([category, v]) => ({
        category,
        revenue: Number(v.revenue.toFixed(2)),
        orders: v.orders.size,
      }))
      .sort((a, b) => b.revenue - a.revenue)
  }

  /**
   * Mapa de calor: receita por hora do dia × dia da semana
   */
  async getRevenueHeatmap() {
    const start = new Date()
    start.setDate(start.getDate() - 89) // ~3 meses
    start.setHours(0, 0, 0, 0)

    const orders = await this.prisma.order.findMany({
      where: { createdAt: { gte: start } },
      select: { createdAt: true, total: true },
    })

    const map = new Map<string, number>()
    for (const order of orders) {
      const d = order.createdAt
      const key = `${d.getDay()}-${d.getHours()}`
      map.set(key, (map.get(key) || 0) + order.total)
    }

    return [...map.entries()].map(([key, total]) => {
      const [day, hour] = key.split('-').map(Number)
      return { dayOfWeek: day, hourOfDay: hour, total: Number(total.toFixed(2)) }
    })
  }
  // ────────────────────────────────────────────────────────────

  async findAll(customerId?: string, context?: Partial<OrderTenantContext>) {
    const scopedWhere = tenantStoreWhere(context)
    const where = {
      ...scopedWhere,
      ...(customerId ? { customerId } : {}),
    }

    return this.prisma.order.findMany({
      where: Object.keys(where).length > 0 ? where : undefined,
      include: {
        customer: true,
        items: { include: { product: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  async findOne(id: string, context?: Partial<OrderTenantContext>) {
    const scopedWhere = tenantStoreWhere(context)
    const include = {
      customer: true,
      items: { include: { product: true } },
    }

    if (Object.keys(scopedWhere).length > 0) {
      return this.prisma.order.findFirst({
        where: { id, ...scopedWhere },
        include,
      })
    }

    return this.prisma.order.findUnique({
      where: { id },
      include,
    })
  }

  async create(createOrderDto: CreateOrderDto): Promise<CreateOrderResult> {
    const {
      customerId,
      items,
      delivery,
      discount,
      paymentMethod,
      notes,
      changeAmount,
      deviceId,
      couponCode,
      deliveryAddressId,
      clientIp,
      tenantId: rawTenantId,
      storeId: rawStoreId,
      channel: rawChannel,
      fulfillmentType: rawFulfillmentType,
      fulfillmentSlotId,
      fulfillmentSlotItemCount,
      deliveryAreaId,
      deliverySnapshot,
      businessAccountId,
      requiresApproval,
    } = createOrderDto
    const tenantId = rawTenantId || DEFAULT_TENANT_ID
    const storeId = rawStoreId || DEFAULT_STORE_ID
    const channel = this.normalizeCode(rawChannel, 'STOREFRONT')
    const fulfillmentType = this.normalizeCode(rawFulfillmentType, 'DELIVERY')

    const idempotency = await this.beginCreateOrderIdempotency(createOrderDto)
    if (idempotency.order) {
      return { order: idempotency.order, whatsapp: null }
    }

    if (!Array.isArray(items) || items.length === 0) {
      await this.markCreateOrderIdempotencyFailed(idempotency.recordId)
      throw new BadRequestException('Pedido deve conter ao menos um item.')
    }

    const customer = await this.prisma.customer.findFirst({ where: { id: customerId, tenantId } })
    if (!customer) {
      await this.markCreateOrderIdempotencyFailed(idempotency.recordId)
      throw new BadRequestException('Cliente do pedido nao encontrado.')
    }

    const address = deliveryAddressId
      ? await this.prisma.address.findFirst({ where: { id: deliveryAddressId, tenantId } })
      : await this.prisma.address.findFirst({ where: { tenantId, customerId, isDefault: true } })

    if (deliveryAddressId && (!address || address.customerId !== customerId)) {
      await this.markCreateOrderIdempotencyFailed(idempotency.recordId)
      throw new BadRequestException('Endereco de entrega nao encontrado para o cliente.')
    }

    // ── Anti-fraude: frete grátis no primeiro pedido ──────────────────
    if (fulfillmentType === 'DELIVERY' && (delivery === 0 || delivery == null)) {
      const customer = await this.prisma.customer.findFirst({ where: { id: customerId, tenantId } })
      if (customer) {
        const log = (vector: string, value: string) =>
          this.prisma.fraudLog.create({ data: { tenantId, storeId, vector, value, customerId } }).catch(() => null)

        // Verificação por WhatsApp
        const prevByWhatsapp = await this.prisma.order.findFirst({
          where: { tenantId, storeId, customer: { whatsapp: customer.whatsapp }, status: { not: 'CANCELLED' } },
        })
        if (prevByWhatsapp) {
          await log('WHATSAPP', customer.whatsapp)
          await this.markCreateOrderIdempotencyFailed(idempotency.recordId)
          throw new BadRequestException('Frete grátis disponível apenas no primeiro pedido.')
        }

        // Verificação por DeviceID
        if (deviceId) {
          const prevByDevice = await this.prisma.order.findFirst({
            where: { tenantId, storeId, deviceId, status: { not: 'CANCELLED' } },
          })
          if (prevByDevice) {
            await log('DEVICE', deviceId)
            await this.markCreateOrderIdempotencyFailed(idempotency.recordId)
            throw new BadRequestException('Frete grátis disponível apenas no primeiro pedido.')
          }
        }

        // Verificação por IP (janela de 24h)
        if (clientIp) {
          const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
          const prevByIp = await this.prisma.order.findFirst({
            where: {
              clientIp,
              tenantId,
              storeId,
              delivery: 0,
              status: { not: 'CANCELLED' },
              createdAt: { gte: since },
            },
          })
          if (prevByIp) {
            await log('IP', clientIp)
            await this.markCreateOrderIdempotencyFailed(idempotency.recordId)
            throw new BadRequestException('Frete grátis disponível apenas no primeiro pedido.')
          }
        }
      }
    }
    // ─────────────────────────────────────────────────────────────────

    const deliveryAmount = typeof delivery === 'number' ? delivery : 0
    if (!Number.isFinite(deliveryAmount) || deliveryAmount < 0) {
      await this.markCreateOrderIdempotencyFailed(idempotency.recordId)
      throw new BadRequestException('Taxa de entrega invalida.')
    }

    let quote
    try {
      quote = await this.pricingService.quote({
        tenantId,
        storeId,
        channel,
        customerId,
        businessAccountId,
        couponCode,
        deliveryAmount,
        items,
      })
    } catch (error) {
      await this.markCreateOrderIdempotencyFailed(idempotency.recordId)
      throw error
    }

    const subtotal = quote.subtotal
    const discountAmount = quote.discountAmount
    const quotedDeliveryAmount = quote.deliveryAmount
    const total = quote.total
    if (quote.businessAccountId && quote.businessMinimumOrder != null && !quote.businessMinimumOrderMet) {
      await this.markCreateOrderIdempotencyFailed(idempotency.recordId)
      throw new BadRequestException(`Pedido B2B abaixo do minimo de R$ ${Number(quote.businessMinimumOrder).toFixed(2)}.`)
    }
    const businessApprovalStatus =
      quote.businessAccountId && (requiresApproval || this.exceedsBusinessCredit(total, quote))
        ? 'PENDING'
        : quote.businessAccountId
        ? 'APPROVED'
        : 'NOT_REQUIRED'
    const orderStatus = businessApprovalStatus === 'PENDING' ? 'PENDING_APPROVAL' : 'PENDING'
    const itemsWithPrices = quote.items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      subtotal: item.subtotal,
    }))
    const orchestrationItems = quote.items.map((item) => ({
      productId: item.productId,
      productName: item.name || null,
      ean: item.ean || null,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      subtotal: item.subtotal,
      scannedCode: items.find((input) => input.productId === item.productId)?.scannedCode || null,
    }))

    // Combine notes and changeAmount for storage
    let finalNotes = notes || ''
    if (changeAmount) {
      finalNotes = finalNotes
        ? `${finalNotes} (Troco para: ${changeAmount})`
        : `Troco para: ${changeAmount}`
    }

    if (couponCode && discountAmount > 0) {
      finalNotes = finalNotes
        ? `${finalNotes} (Cupom: ${couponCode.toUpperCase()})`
        : `Cupom: ${couponCode.toUpperCase()}`
    }

    const orderId = `order_${randomUUID()}`
    try {
      await this.inventoryService.reserveForCheckout({
        tenantId,
        storeId,
        orderId,
        cartId: idempotency.recordId,
        items: itemsWithPrices.map((item) => ({ productId: item.productId, quantity: item.quantity })),
      })
    } catch (error) {
      await this.markCreateOrderIdempotencyFailed(idempotency.recordId)
      throw error
    }

    const order = await this.prisma.order.create({
      data: {
        id: orderId,
        customerId,
        tenantId,
        storeId,
        subtotal,
        delivery: quotedDeliveryAmount,
        discount: discountAmount,
        total,
        channel,
        fulfillmentType,
        fulfillmentSlotId: fulfillmentSlotId || null,
        fulfillmentSlotItemCount: fulfillmentSlotId ? Math.max(0, Math.ceil(Number(fulfillmentSlotItemCount || itemsWithPrices.length))) : null,
        deliveryAreaId: deliveryAreaId || null,
        status: orderStatus,
        paymentMethod: paymentMethod || 'CASH',
        notes: finalNotes || null,
        deviceId,
        clientIp,
        customerSnapshot: this.buildCustomerSnapshot(customer),
        addressSnapshot: address ? this.buildAddressSnapshot(address) : Prisma.JsonNull,
        deliverySnapshot: this.buildDeliverySnapshot(quotedDeliveryAmount, address, deliverySnapshot, fulfillmentType, fulfillmentSlotId, deliveryAreaId),
        priceSnapshot: this.buildPriceSnapshot({ subtotal, deliveryAmount: quotedDeliveryAmount, discountAmount, total, couponCode, quote }),
        businessAccountId: quote.businessAccountId || null,
        businessApprovalStatus,
        businessPaymentTerms: quote.businessPaymentTerms || null,
        businessInvoiceSnapshot: quote.businessAccountId
          ? {
              businessAccountId: quote.businessAccountId,
              paymentTerms: quote.businessPaymentTerms || null,
              approvalStatus: businessApprovalStatus,
            }
          : Prisma.JsonNull,
        items: {
          create: itemsWithPrices.map((item) => ({
            ...item,
            tenantId,
            storeId,
            requestedQuantity: this.decimal3(item.quantity),
            fulfilledQuantity: this.decimal3(item.quantity),
            finalUnitPrice: this.decimal2(item.unitPrice),
            finalSubtotal: this.decimal2(item.subtotal),
            status: 'PENDING',
            substitutionPolicy: 'ALLOW',
          })),
        },
      },
      include: {
        customer: true,
        items: { include: { product: true } },
      },
    }).catch(async (error) => {
      await this.inventoryService.releaseOrderReservations(orderId, 'Falha ao criar pedido apos reserva')
      await this.markCreateOrderIdempotencyFailed(idempotency.recordId)
      throw error
    })

    await this.recordOrderEvent(order, 'order.created', {
      status: order.status,
      paymentStatus: order.paymentStatus,
      channel,
      fulfillmentType,
      subtotal,
      delivery: quotedDeliveryAmount,
      discount: discountAmount,
      total,
      itemCount: order.items.length,
      fulfillmentSlotId: order.fulfillmentSlotId,
      deliveryAreaId: order.deliveryAreaId,
      businessAccountId: order.businessAccountId,
      businessApprovalStatus: order.businessApprovalStatus,
    })

    await this.prisma.idempotencyKey.update({
      where: { id: idempotency.recordId },
      data: { status: 'COMPLETED', responseRef: order.id },
    })

    await this.pricingService.recordPromotionUsage(quote, order.id, customerId)

    if (businessApprovalStatus !== 'PENDING') {
      await this.orderOrchestrationService.syncCreatedOrder(this.toOrderOrchestrationPayload(order, orchestrationItems))
    }

    const whatsapp = businessApprovalStatus === 'PENDING' ? null : await this.sendWhatsAppMessage(order, changeAmount)

    return {
      order,
      whatsapp,
    }
  }

  async update(id: string, updateOrderDto: UpdateOrderDto) {
    const { items, ...updateData } = updateOrderDto
    const order = await this.prisma.order.update({
      where: { id },
      data: updateData,
      include: {
        customer: true,
        items: { include: { product: true } },
      },
    })

    await this.recordOrderEvent(order, 'order.updated', {
      changedFields: Object.keys(updateData),
    })

    return order
  }

  async updateStatus(id: string, status: string, reason?: string, actor?: OrderOmsActor) {
    const previousOrder = await this.prisma.order.findUnique({
      where: { id },
      include: {
        customer: true,
        items: { include: { product: true } },
      },
    })
    if (!previousOrder) {
      throw new NotFoundException('Pedido nao encontrado.')
    }

    if (status === 'CONFIRMED') {
      if (this.requiresOnlinePaymentAuthorization(previousOrder)) {
        throw new BadRequestException('Pedido online so pode ser confirmado apos pagamento autorizado ou capturado.')
      }

      const activeReservations = await this.prisma.stockReservation.count({
        where: { orderId: id, status: 'ACTIVE' },
      })
      if (activeReservations === 0) {
        throw new BadRequestException('Pedido nao possui reserva de estoque ativa para confirmacao.')
      }
    }

    const order = await this.prisma.order.update({
      where: { id },
      data: { 
        status,
        ...(reason && { cancellationReason: reason })
      },
      include: {
        customer: true,
        items: { include: { product: true } },
      },
    })

    if (status === 'CANCELLED') {
      await this.inventoryService.releaseOrderReservations(order.id, reason || 'Pedido cancelado')
      await this.releaseFulfillmentSlotReservation(previousOrder, reason || 'Pedido cancelado')
      await this.orderOrchestrationService.syncCancelledOrder(
        this.toOrderOrchestrationPayload(
          order,
          order.items.map((item) => ({
            productId: item.productId,
            productName: item.product?.name || null,
            ean: item.product?.ean || null,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            subtotal: item.subtotal,
            scannedCode: null,
          })),
        ),
        reason,
      )
    }

    await this.whatsappService.sendStatusUpdate(
      order.customer.whatsapp,
      order.id.slice(-8).toUpperCase(),
      order.status,
    )

    await this.notificationsService.create({
      type: 'ORDER_UPDATE',
      title: `Pedido ${order.id.slice(-8).toUpperCase()} atualizado`,
      body: `Seu pedido agora está com status: ${order.status}.`,
      customerId: order.customerId,
    })

    if (status === 'CONFIRMED') {
      await this.inventoryService.consumeOrderReservations(order.id)
      this.integrationsService.syncFiscalDocument(order.id).catch((err: Error) => {
        this.logger.warn(`Falha ao emitir NF-e para pedido ${order.id}: ${err.message}`)
      })
      if (process.env.ENABLE_PAYMENTS_INTEGRATION === 'true') {
        this.integrationsService.syncChargePayment(order.id).catch((err: Error) => {
          this.logger.warn(`Falha ao gerar cobrança para pedido ${order.id}: ${err.message}`)
        })
      }
    }

    await this.auditLogService.log({
      action: 'UPDATE_STATUS',
      entity: 'ORDER',
      entityId: order.id,
      changes: { status },
    })

    await this.recordOrderEvent(order, this.orderEventTypeForStatus(status), {
      previousStatus: previousOrder.status,
      status,
      reason: reason || null,
    }, actor)

    return order
  }

  async remove(id: string) {
    return this.prisma.order.delete({
      where: { id },
    })
  }

  async findAdminOrders(context: Partial<OrderTenantContext>, filters: AdminOrderFilters = {}) {
    const limit = Math.min(Math.max(Number(filters.limit || 50), 1), 200)
    const where: Prisma.OrderWhereInput = {
      ...tenantStoreWhere(context),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.paymentStatus ? { paymentStatus: filters.paymentStatus } : {}),
      ...(filters.customerId ? { customerId: filters.customerId } : {}),
    }

    return this.prisma.order.findMany({
      where,
      include: {
        customer: true,
        items: { include: { product: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
  }

  async findAdminOrder(id: string, context: Partial<OrderTenantContext>) {
    const order = await this.findOrderForOms(id, context)
    const events = await this.prisma.orderEvent.findMany({
      where: { orderId: id, ...tenantStoreWhere(context) },
      orderBy: { createdAt: 'asc' },
    })

    return { ...order, events }
  }

  async addOrderEvent(
    id: string,
    dto: { type: string; payload?: Record<string, unknown>; status?: string; paymentStatus?: string },
    context: Partial<OrderTenantContext>,
    actor?: OrderOmsActor,
  ) {
    const current = await this.findOrderForOms(id, context)
    const data: Prisma.OrderUpdateInput = {}
    if (dto.status && dto.status !== current.status) data.status = dto.status
    if (dto.paymentStatus && dto.paymentStatus !== current.paymentStatus) data.paymentStatus = dto.paymentStatus

    const order = Object.keys(data).length > 0
      ? await this.prisma.order.update({
          where: { id },
          data,
          include: {
            customer: true,
            items: { include: { product: true } },
          },
        })
      : current

    const event = await this.recordOrderEvent(order, dto.type, {
      ...(dto.payload || {}),
      previousStatus: current.status,
      status: order.status,
      previousPaymentStatus: current.paymentStatus,
      paymentStatus: order.paymentStatus,
    }, actor)

    return { order, event }
  }

  async cancelOrder(id: string, reason: string | undefined, context: Partial<OrderTenantContext>, actor?: OrderOmsActor) {
    await this.findOrderForOms(id, context)
    return this.updateStatus(id, 'CANCELLED', reason, actor)
  }

  async cancelOrderItem(
    orderId: string,
    itemId: string,
    dto: { reason?: string; pickerNotes?: string },
    context: Partial<OrderTenantContext>,
    actor?: OrderOmsActor,
  ) {
    const order = await this.findOrderForOms(orderId, context)
    const item = await this.prisma.orderItem.findFirst({
      where: { id: itemId, orderId, tenantId: order.tenantId, storeId: order.storeId },
      include: { product: true },
    })
    if (!item) throw new NotFoundException('Item do pedido nao encontrado.')

    const updatedItem = await this.prisma.orderItem.update({
      where: { id: itemId },
      data: {
        status: 'CANCELLED',
        fulfilledQuantity: this.decimal3(0),
        finalUnitPrice: this.decimal2(this.numberValue(item.finalUnitPrice) ?? item.unitPrice),
        finalSubtotal: this.decimal2(0),
        cutReason: dto.reason || null,
        pickerNotes: dto.pickerNotes || null,
      },
      include: { product: true },
    })

    const recalculated = await this.recalculateOrderTotals(orderId)
    await this.recordOrderEvent(recalculated, 'order.item_cancelled', {
      itemId,
      productId: item.productId,
      productName: item.product?.name || null,
      previousStatus: item.status,
      status: updatedItem.status,
      reason: dto.reason || null,
      pickerNotes: dto.pickerNotes || null,
      total: recalculated.total,
    }, actor)

    return { order: recalculated, item: updatedItem }
  }

  async substituteOrderItem(
    orderId: string,
    itemId: string,
    dto: { substituteProductId: string; quantity?: number; reason?: string; pickerNotes?: string },
    context: Partial<OrderTenantContext>,
    actor?: OrderOmsActor,
  ) {
    const order = await this.findOrderForOms(orderId, context)
    const item = await this.prisma.orderItem.findFirst({
      where: { id: itemId, orderId, tenantId: order.tenantId, storeId: order.storeId },
      include: { product: true },
    })
    if (!item) throw new NotFoundException('Item do pedido nao encontrado.')

    const substitute = await this.prisma.product.findFirst({
      where: {
        id: dto.substituteProductId,
        tenantId: order.tenantId,
        storeId: order.storeId,
        active: true,
      },
    })
    if (!substitute) throw new NotFoundException('Produto substituto nao encontrado.')

    const quantity = dto.quantity ?? this.numberValue(item.fulfilledQuantity) ?? item.quantity
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new BadRequestException('Quantidade de substituicao invalida.')
    }

    const unitPrice = substitute.promotionalPrice ?? substitute.price
    const subtotal = this.roundMoney(unitPrice * quantity)
    const substituteItem = await this.prisma.orderItem.create({
      data: {
        tenantId: order.tenantId,
        storeId: order.storeId,
        orderId,
        productId: substitute.id,
        quantity,
        unitPrice,
        subtotal,
        requestedQuantity: this.decimal3(quantity),
        fulfilledQuantity: this.decimal3(quantity),
        finalUnitPrice: this.decimal2(unitPrice),
        finalSubtotal: this.decimal2(subtotal),
        status: 'PICKED',
        substitutionPolicy: item.substitutionPolicy || 'ALLOW',
        pickerNotes: dto.pickerNotes || null,
      },
      include: { product: true },
    })

    const updatedItem = await this.prisma.orderItem.update({
      where: { id: itemId },
      data: {
        status: 'SUBSTITUTED',
        fulfilledQuantity: this.decimal3(0),
        finalSubtotal: this.decimal2(0),
        substitutedByItemId: substituteItem.id,
        cutReason: dto.reason || null,
        pickerNotes: dto.pickerNotes || null,
      },
      include: { product: true },
    })

    const recalculated = await this.recalculateOrderTotals(orderId)
    await this.recordOrderEvent(recalculated, 'order.substitution_accepted', {
      sourceItemId: item.id,
      sourceProductId: item.productId,
      sourceProductName: item.product?.name || null,
      substituteItemId: substituteItem.id,
      substituteProductId: substitute.id,
      substituteProductName: substitute.name,
      quantity,
      unitPrice,
      subtotal,
      reason: dto.reason || null,
      pickerNotes: dto.pickerNotes || null,
      total: recalculated.total,
    }, actor)

    return { order: recalculated, sourceItem: updatedItem, substituteItem }
  }

  async recalculateOrder(id: string, context: Partial<OrderTenantContext>, actor?: OrderOmsActor) {
    await this.findOrderForOms(id, context)
    const order = await this.recalculateOrderTotals(id)
    await this.recordOrderEvent(order, 'order.recalculated', {
      subtotal: order.subtotal,
      delivery: order.delivery,
      discount: order.discount,
      total: order.total,
    }, actor)
    return order
  }

  private async findOrderForOms(id: string, context?: Partial<OrderTenantContext>): Promise<OrderWithRelations> {
    const scopedWhere = tenantStoreWhere(context)
    const include = {
      customer: true,
      items: { include: { product: true } },
    }

    const order = Object.keys(scopedWhere).length > 0
      ? await this.prisma.order.findFirst({
          where: { id, ...scopedWhere },
          include,
        })
      : await this.prisma.order.findUnique({
          where: { id },
          include,
        })

    if (!order) throw new NotFoundException('Pedido nao encontrado.')
    return order
  }

  private async recalculateOrderTotals(orderId: string): Promise<OrderWithRelations> {
    const order = await this.findOrderForOms(orderId)
    const activeItems = await this.prisma.orderItem.findMany({
      where: { orderId },
      include: { product: true },
    })

    const subtotal = activeItems.reduce((sum, item) => {
      if (['CANCELLED', 'SUBSTITUTED'].includes(item.status)) return sum
      const finalSubtotal = this.numberValue(item.finalSubtotal)
      return sum + (finalSubtotal ?? item.subtotal)
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

  private async releaseFulfillmentSlotReservation(order: OrderWithRelations, reason: string) {
    if (order.status === 'CANCELLED' || !order.fulfillmentSlotId) return null

    const slot = await this.prisma.fulfillmentSlot.findFirst({
      where: {
        id: order.fulfillmentSlotId,
        tenantId: order.tenantId,
        storeId: order.storeId,
      },
    })
    if (!slot) return null

    const itemCount = Math.max(
      0,
      Math.ceil(Number(order.fulfillmentSlotItemCount || order.items.reduce((sum, item) => sum + item.quantity, 0))),
    )
    const updated = await this.prisma.fulfillmentSlot.update({
      where: { id: slot.id },
      data: {
        reservedOrders: Math.max(0, slot.reservedOrders - 1),
        reservedItems: Math.max(0, slot.reservedItems - itemCount),
      },
    })

    await this.prisma.fulfillmentEvent.create({
      data: {
        tenantId: order.tenantId,
        storeId: order.storeId,
        orderId: order.id,
        type: 'slot.released',
        payload: this.toJsonPayload({ slotId: slot.id, itemCount, reason }),
      },
    }).catch(() => null)

    return updated
  }

  private async recordOrderEvent(
    order: Pick<OrderWithRelations, 'id' | 'tenantId' | 'storeId' | 'status' | 'paymentStatus'>,
    type: string,
    payload: Record<string, unknown>,
    actor?: OrderOmsActor,
  ) {
    const event = await this.prisma.orderEvent.create({
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

    const webhookType = type === 'order.created'
      ? 'order.created'
      : payload.previousStatus || payload.status
        ? 'order.status_changed'
        : null
    if (webhookType) {
      this.publicApiService.emitWebhookEvent(webhookType, {
        orderId: order.id,
        eventType: type,
        status: order.status,
        paymentStatus: order.paymentStatus,
        payload,
      }, order.tenantId || DEFAULT_TENANT_ID, order.storeId || DEFAULT_STORE_ID).catch(() => null)
    }

    return event
  }

  private toJsonPayload(payload: Record<string, unknown>): Prisma.InputJsonObject {
    return JSON.parse(JSON.stringify(payload || {})) as Prisma.InputJsonObject
  }

  private orderEventTypeForStatus(status: string) {
    const eventByStatus: Record<string, string> = {
      CREATED: 'order.created',
      PAYMENT_PENDING: 'order.payment_pending',
      CONFIRMED: 'order.confirmed',
      PICKING_PENDING: 'order.picking_pending',
      PICKING: 'order.picking_started',
      WAITING_CUSTOMER_SUBSTITUTION: 'order.waiting_customer_substitution',
      CONFERENCE_PENDING: 'order.conference_pending',
      PACKING: 'order.packed',
      READY_FOR_PICKUP: 'order.ready_for_pickup',
      READY_FOR_DELIVERY: 'order.ready_for_delivery',
      OUT_FOR_DELIVERY: 'order.out_for_delivery',
      DELIVERED: 'order.delivered',
      COMPLETED: 'order.completed',
      PARTIALLY_CANCELLED: 'order.partially_cancelled',
      CANCELLED: 'order.cancelled',
      REFUNDED: 'order.refunded',
      FAILED_SYNC: 'order.failed_sync',
    }

    return eventByStatus[status] || 'order.status_updated'
  }

  private normalizeCode(value: string | undefined, fallback: string) {
    const normalized = String(value || fallback).trim().toUpperCase()
    return normalized || fallback
  }

  private exceedsBusinessCredit(total: number, quote: { businessCreditLimit?: number | null }) {
    if (quote.businessCreditLimit == null) return false
    return Number(total || 0) > Number(quote.businessCreditLimit)
  }

  private requiresOnlinePaymentAuthorization(order: Pick<OrderWithRelations, 'paymentMethod' | 'paymentStatus'>) {
    const gatewayActive = ['ENABLE_PAYMENTS_INTEGRATION', 'INTEGRATION_PAYMENTS_ENABLED'].some((key) => {
      const value = String(process.env[key] || '').trim().toLowerCase()
      return value === 'true' || value === '1' || value === 'yes' || value === 'on'
    })
    if (!gatewayActive) return false

    const offlineMethods = new Set(['CASH', 'DINHEIRO', 'MONEY', 'CARD', 'CARD_ON_DELIVERY', 'CARTAO', 'CARTAO_ENTREGA'])
    const method = this.normalizeCode(order.paymentMethod, 'CASH')
    if (offlineMethods.has(method)) return false

    const paidStatuses = new Set(['PAID', 'AUTHORIZED', 'CAPTURED'])
    return !paidStatuses.has(this.normalizeCode(order.paymentStatus, 'UNPAID'))
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

  private async beginCreateOrderIdempotency(createOrderDto: CreateOrderDto): Promise<{ recordId: string; order?: OrderWithRelations }> {
    const key = String(createOrderDto.idempotencyKey || '').trim()
    if (!key) {
      throw new BadRequestException('idempotencyKey e obrigatorio para criar pedido.')
    }

    const tenantId = createOrderDto.tenantId || DEFAULT_TENANT_ID
    const storeId = createOrderDto.storeId || DEFAULT_STORE_ID
    const scope = `orders:create:${tenantId}:${storeId}:${createOrderDto.customerId}`
    const requestHash = this.hashCreateOrderRequest(createOrderDto)

    const existing = await this.prisma.idempotencyKey.findUnique({
      where: { tenantId_storeId_scope_key: { tenantId, storeId, scope, key } },
    })

    if (existing) {
      if (existing.requestHash !== requestHash) {
        throw new BadRequestException('idempotencyKey ja foi usada com outro payload.')
      }

      if (existing.status === 'COMPLETED' && existing.responseRef) {
        const order = await this.findOne(existing.responseRef, { tenantId, storeId })
        if (order) return { recordId: existing.id, order }
      }

      if (existing.status === 'PROCESSING') {
        throw new BadRequestException('Pedido ja esta em processamento para esta idempotencyKey.')
      }

      const updated = await this.prisma.idempotencyKey.update({
        where: { id: existing.id },
        data: {
          status: 'PROCESSING',
          responseRef: null,
          expiresAt: this.idempotencyExpiresAt(),
        },
      })
      return { recordId: updated.id }
    }

    try {
      const created = await this.prisma.idempotencyKey.create({
        data: {
          tenantId,
          storeId,
          scope,
          key,
          requestHash,
          status: 'PROCESSING',
          expiresAt: this.idempotencyExpiresAt(),
        },
      })
      return { recordId: created.id }
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return this.beginCreateOrderIdempotency(createOrderDto)
      }
      throw error
    }
  }

  private async markCreateOrderIdempotencyFailed(recordId: string) {
    await this.prisma.idempotencyKey.update({
      where: { id: recordId },
      data: { status: 'FAILED' },
    }).catch(() => null)
  }

  private hashCreateOrderRequest(createOrderDto: CreateOrderDto) {
    const normalized = {
      customerId: createOrderDto.customerId,
      items: Array.isArray(createOrderDto.items)
        ? createOrderDto.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            scannedCode: item.scannedCode ?? null,
          }))
        : [],
      delivery: createOrderDto.delivery ?? null,
      discount: createOrderDto.discount ?? null,
      paymentMethod: createOrderDto.paymentMethod ?? null,
      notes: createOrderDto.notes ?? null,
      changeAmount: createOrderDto.changeAmount ?? null,
      deviceId: createOrderDto.deviceId ?? null,
      couponCode: createOrderDto.couponCode ?? null,
      deliveryAddressId: createOrderDto.deliveryAddressId ?? null,
      tenantId: createOrderDto.tenantId || DEFAULT_TENANT_ID,
      storeId: createOrderDto.storeId || DEFAULT_STORE_ID,
      channel: this.normalizeCode(createOrderDto.channel, 'STOREFRONT'),
      fulfillmentType: this.normalizeCode(createOrderDto.fulfillmentType, 'DELIVERY'),
      fulfillmentSlotId: createOrderDto.fulfillmentSlotId ?? null,
      fulfillmentSlotItemCount: createOrderDto.fulfillmentSlotItemCount ?? null,
      deliveryAreaId: createOrderDto.deliveryAreaId ?? null,
    }

    return createHash('sha256').update(JSON.stringify(normalized)).digest('hex')
  }

  private idempotencyExpiresAt() {
    return new Date(Date.now() + 24 * 60 * 60 * 1000)
  }

  private buildCustomerSnapshot(customer: {
    id: string
    name: string
    cpf?: string | null
    whatsapp: string
    email?: string | null
  }) {
    return {
      id: customer.id,
      name: customer.name,
      cpf: customer.cpf ?? null,
      whatsapp: customer.whatsapp,
      email: customer.email ?? null,
    }
  }

  private buildAddressSnapshot(address: {
    id: string
    street: string
    number: string
    complement?: string | null
    neighborhood: string
    city: string
    state: string
    zipCode: string
  }) {
    return {
      id: address.id,
      street: address.street,
      number: address.number,
      complement: address.complement ?? null,
      neighborhood: address.neighborhood,
      city: address.city,
      state: address.state,
      zipCode: address.zipCode,
    }
  }

  private buildDeliverySnapshot(
    deliveryAmount: number,
    address?: { id: string; zipCode: string } | null,
    snapshot?: Record<string, unknown> | null,
    fulfillmentType = 'DELIVERY',
    fulfillmentSlotId?: string | null,
    deliveryAreaId?: string | null,
  ) {
    return {
      ...(snapshot || {}),
      fee: deliveryAmount,
      mode: fulfillmentType,
      outOfArea: Boolean(snapshot?.outOfArea ?? false),
      addressId: address?.id ?? null,
      zipCode: address?.zipCode ?? null,
      fulfillmentSlotId: fulfillmentSlotId || null,
      deliveryAreaId: deliveryAreaId || null,
    }
  }

  private buildPriceSnapshot({
    subtotal,
    deliveryAmount,
    discountAmount,
    total,
    couponCode,
    quote,
  }: {
    subtotal: number
    deliveryAmount: number
    discountAmount: number
    total: number
    couponCode?: string
    quote?: {
      channel?: string
      originalDeliveryAmount?: number
      appliedPromotions?: unknown[]
      estimatedMargin?: number | null
      items?: Array<{ productId: string; unitPrice: number; priceListId: string | null; margin: number | null }>
    }
  }): Prisma.InputJsonObject {
    const promotions = JSON.parse(JSON.stringify(quote?.appliedPromotions || [])) as Prisma.InputJsonValue
    const quoteItems = JSON.parse(JSON.stringify(quote?.items?.map((item) => ({
      productId: item.productId,
      unitPrice: item.unitPrice,
      priceListId: item.priceListId,
      margin: item.margin,
    })) || [])) as Prisma.InputJsonValue

    return {
      subtotal,
      delivery: deliveryAmount,
      originalDelivery: quote?.originalDeliveryAmount ?? deliveryAmount,
      discount: discountAmount,
      total,
      couponCode: couponCode ? couponCode.toUpperCase() : null,
      channel: quote?.channel || 'STOREFRONT',
      appliedPromotions: promotions,
      estimatedMargin: quote?.estimatedMargin ?? null,
      items: quoteItems,
    }
  }

  private async sendWhatsAppMessage(order: OrderWithRelations, changeAmount?: string): Promise<WhatsAppDispatchResult | null> {
    return this.whatsappService.sendOrderConfirmation(order.customer.whatsapp, {
      id: order.id.slice(-8).toUpperCase(),
      total: order.total,
      items: order.items.reduce((sum, item) => sum + item.quantity, 0),
      paymentMethod: order.paymentMethod,
      notes: order.notes,
      changeAmount: changeAmount,
    })
  }

  private toOrderOrchestrationPayload(
    order: OrderWithRelations,
    sourceItems: Array<{
      productId: string
      productName: string | null
      ean: string | null
      quantity: number
      unitPrice: number
      subtotal: number
      scannedCode?: string | null
    }>,
  ): InternalOrderContract {
    const sourceByProduct = new Map(sourceItems.map((item) => [item.productId, item]))

    return {
      orderId: order.id,
      customerId: order.customerId,
      fulfillmentType: order.fulfillmentType,
      fulfillmentSlotId: order.fulfillmentSlotId,
      deliveryAreaId: order.deliveryAreaId,
      status: order.status,
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod,
      subtotal: order.subtotal,
      delivery: order.delivery,
      discount: order.discount,
      total: order.total,
      notes: order.notes,
      customer: {
        id: order.customer.id,
        cpf: order.customer.cpf,
        name: order.customer.name,
        whatsapp: order.customer.whatsapp,
        email: order.customer.email,
      },
      items: order.items.map((item) => {
        const source = sourceByProduct.get(item.productId)

        return {
          productId: item.productId,
          productName: source?.productName || item.product?.name || null,
          ean: source?.ean || item.product?.ean || null,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          subtotal: item.subtotal,
          scannedCode: source?.scannedCode || null,
        }
      }),
    }
  }
  async listFraudLogs({ limit = 100, vector }: { limit?: number; vector?: string }) {
    return this.prisma.fraudLog.findMany({
      where: vector ? { vector } : undefined,
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 500),
    })
  }}
