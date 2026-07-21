import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../../common/prisma.service'
import { DEFAULT_STORE_ID, DEFAULT_TENANT_ID } from '../../common/tenant/tenant.constants'
import { TenantContext } from '../../common/tenant/tenant-context'
import { DeliveryService } from '../delivery/delivery.service'
import { InventoryService } from '../inventory/inventory.service'
import { OrdersService } from '../orders/orders.service'
import { PricingService } from '../pricing/pricing.service'
import { CartService } from './cart.service'
import { ConfirmCheckoutSessionDto, CreateCheckoutSessionDto, QuoteCheckoutSessionDto } from './dto/checkout.dto'

type CheckoutContext = Partial<Pick<TenantContext, 'tenantId' | 'storeId'>>

type SessionRecord = Prisma.CheckoutSessionGetPayload<Record<string, never>>

type CartPayload = Awaited<ReturnType<CartService['findCart']>>

type StockSnapshot = {
  allAvailable: boolean
  unavailableItems: Array<{ productId: string; requested: number; available: number }>
  items: Array<{
    productId: string
    requested: number
    available: number
    inStock: boolean
    allowSubstitution: boolean
    substitutionStatus: 'ACCEPTED' | 'DECLINED'
  }>
}

type DeliverySnapshot = {
  mode: string
  fee: number | null
  rawFee: number | null
  freeAbove: number | null
  minimumOrder: number | null
  minimumOrderMet: boolean
  zoneName: string | null
  zoneId: string | null
  isFree: boolean
  outOfArea: boolean
  validSlot: boolean
  addressId: string | null
  zipCode: string | null
  slot: {
    id: string | null
    windowStart: string | null
    windowEnd: string | null
    type: string | null
    availableOrders: number | null
    availableItems: number | null
    reason: string | null
  }
}

@Injectable()
export class CheckoutService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cartService: CartService,
    private readonly pricingService: PricingService,
    private readonly inventoryService: InventoryService,
    private readonly deliveryService: DeliveryService,
    private readonly ordersService: OrdersService,
  ) {}

  async createSession(context: CheckoutContext | undefined, dto: CreateCheckoutSessionDto) {
    const { tenantId, storeId } = this.resolveContext(context)
    const cart = await this.cartService.findCart(dto.cartId, { tenantId, storeId })
    if (cart.status !== 'ACTIVE') throw new BadRequestException('Carrinho nao esta ativo.')

    const key = String(dto.idempotencyKey || '').trim()
    if (!key) throw new BadRequestException('idempotencyKey e obrigatorio para sessao de checkout.')

    const existing = await this.prisma.checkoutSession.findUnique({
      where: { tenantId_storeId_idempotencyKey: { tenantId, storeId, idempotencyKey: key } },
    })
    if (existing) {
      if (existing.cartId !== cart.id) {
        throw new BadRequestException('idempotencyKey ja foi usada com outro carrinho.')
      }
      return { session: this.toSessionPayload(existing), reused: true }
    }

    const session = await this.prisma.checkoutSession.create({
      data: {
        tenantId,
        storeId,
        cartId: cart.id,
        customerId: this.optionalString(dto.customerId) || cart.customerId,
        idempotencyKey: key,
        status: 'STARTED',
        expiresAt: this.expiresAt(dto.ttlMinutes || 30),
      },
    })

    await this.recordEvent({
      tenantId,
      storeId,
      cartId: cart.id,
      checkoutSessionId: session.id,
      type: 'SESSION_STARTED',
      customerId: session.customerId,
      deviceId: cart.deviceId,
      metadata: { expiresAt: session.expiresAt.toISOString() },
    })

    return { session: this.toSessionPayload(session), reused: false }
  }

  async quoteSession(context: CheckoutContext | undefined, id: string, dto: QuoteCheckoutSessionDto) {
    const result = await this.buildQuote(context, id, dto, { persist: true })
    return {
      session: this.toSessionPayload(result.session),
      cart: result.cart,
      price: result.price,
      delivery: result.delivery,
      stock: result.stock,
      canConfirm: result.canConfirm,
      blockers: result.blockers,
    }
  }

  async confirmSession(context: CheckoutContext | undefined, id: string, dto: ConfirmCheckoutSessionDto & { clientIp?: string }) {
    const { tenantId, storeId } = this.resolveContext(context)
    const session = await this.findSessionOrThrow(id, { tenantId, storeId })

    if (session.status === 'COMPLETED' && session.orderId) {
      const order = await this.ordersService.findOne(session.orderId, { tenantId, storeId })
      if (order) return { session: this.toSessionPayload(session), order, reused: true }
    }

    const quote = await this.buildQuote({ tenantId, storeId }, id, dto, { persist: true })
    if (!quote.canConfirm) {
      throw new BadRequestException(`Checkout bloqueado: ${quote.blockers.join('; ')}`)
    }

    const customerId = this.optionalString(dto.customerId) || quote.session.customerId || quote.cart.customerId
    if (!customerId) throw new BadRequestException('customerId e obrigatorio para confirmar checkout.')

    const paymentMethod = String(dto.paymentMethod || 'CASH').toUpperCase()
    const paymentSnapshot = this.buildPaymentSnapshot(paymentMethod)

    await this.prisma.checkoutSession.update({
      where: { id },
      data: {
        status: paymentSnapshot.online ? 'PAYMENT_PENDING' : 'RESERVED',
        paymentSnapshot,
      },
    })

    try {
      const result = await this.ordersService.create({
        customerId,
        idempotencyKey: this.orderIdempotencyKey(quote.session),
        items: quote.cart.items.map((item) => ({ productId: item.productId, quantity: Number(item.quantity) })),
        delivery: Number(quote.delivery.fee || 0),
        paymentMethod,
        notes: dto.notes,
        changeAmount: dto.changeAmount,
        deviceId: dto.deviceId || quote.cart.deviceId || undefined,
        couponCode: dto.couponCode,
        deliveryAddressId: quote.delivery.addressId || dto.deliveryAddressId,
        fulfillmentType: quote.delivery.mode,
        fulfillmentSlotId: quote.delivery.slot.id || undefined,
        fulfillmentSlotItemCount: quote.delivery.slot.id ? this.cartItemCount(quote.cart) : undefined,
        deliveryAreaId: quote.delivery.zoneId || undefined,
        deliverySnapshot: quote.delivery,
        clientIp: dto.clientIp,
        tenantId,
        storeId,
      })

      const completed = await this.prisma.checkoutSession.update({
        where: { id },
        data: {
          status: 'COMPLETED',
          customerId,
          orderId: result.order.id,
          paymentSnapshot: { ...paymentSnapshot, orderId: result.order.id },
          fulfillmentSlotReserved: false,
        },
      })
      await this.cartService.markConverted(quote.cart.id, { tenantId, storeId })
      await this.recordEvent({
        tenantId,
        storeId,
        cartId: quote.cart.id,
        checkoutSessionId: completed.id,
        type: 'ORDER_CREATED',
        customerId,
        deviceId: dto.deviceId || quote.cart.deviceId,
        metadata: { orderId: result.order.id, total: result.order.total },
      })
      await this.prisma.analyticsEvent.create({
        data: {
          tenantId,
          storeId,
          type: 'ORDER_CREATED',
          entity: 'ORDER',
          entityId: result.order.id,
          customerId,
          deviceId: dto.deviceId || quote.cart.deviceId || null,
          metadata: JSON.stringify({ cartId: quote.cart.id, checkoutSessionId: completed.id, total: result.order.total }),
        },
      })

      return { session: this.toSessionPayload(completed), order: result.order, whatsapp: result.whatsapp, reused: false }
    } catch (error) {
      await this.prisma.checkoutSession.update({
        where: { id },
        data: { status: 'FAILED', paymentSnapshot: { ...paymentSnapshot, failure: this.errorMessage(error) } },
      }).catch(() => null)
      await this.inventoryService.releaseReservationsByCart(quote.cart.id, 'Checkout falhou antes da conclusao').catch(() => null)
      await this.releaseSessionSlotReservation(quote.session, { tenantId, storeId }, 'Checkout falhou antes da conclusao').catch(() => null)
      await this.recordEvent({
        tenantId,
        storeId,
        cartId: quote.cart.id,
        checkoutSessionId: id,
        type: 'SESSION_FAILED',
        customerId,
        deviceId: dto.deviceId || quote.cart.deviceId,
        metadata: { reason: this.errorMessage(error) },
      }).catch(() => null)
      throw error
    }
  }

  async cancelSession(context: CheckoutContext | undefined, id: string, reason = 'Checkout cancelado') {
    const { tenantId, storeId } = this.resolveContext(context)
    const session = await this.findSessionOrThrow(id, { tenantId, storeId }, { allowFailed: true })
    if (session.status === 'COMPLETED') throw new BadRequestException('Checkout concluido nao pode ser cancelado por este endpoint.')

    const cart = await this.cartService.findCart(session.cartId, { tenantId, storeId }).catch(() => null)
    const [releasedBySession, releasedByCart] = await Promise.all([
      this.inventoryService.releaseReservationsByCart(session.id, reason).catch(() => ({ count: 0 })),
      this.inventoryService.releaseReservationsByCart(session.cartId, reason).catch(() => ({ count: 0 })),
    ])
    await this.releaseSessionSlotReservation(session, { tenantId, storeId }, reason).catch(() => null)
    const updated = await this.prisma.checkoutSession.update({
      where: { id: session.id },
      data: {
        status: 'FAILED',
        fulfillmentSlotReserved: false,
        fulfillmentSlotId: null,
        fulfillmentSlotItemCount: 0,
      },
    })

    await this.recordEvent({
      tenantId,
      storeId,
      cartId: session.cartId,
      checkoutSessionId: session.id,
      type: 'SESSION_CANCELLED',
      customerId: session.customerId,
      deviceId: cart?.deviceId,
      metadata: {
        reason,
        releasedReservations: Number(releasedBySession.count || 0) + Number(releasedByCart.count || 0),
      },
    })

    return { session: this.toSessionPayload(updated), releasedReservations: Number(releasedBySession.count || 0) + Number(releasedByCart.count || 0) }
  }

  private async buildQuote(
    context: CheckoutContext | undefined,
    id: string,
    dto: QuoteCheckoutSessionDto,
    options: { persist: boolean },
  ) {
    const { tenantId, storeId } = this.resolveContext(context)
    const session = await this.findSessionOrThrow(id, { tenantId, storeId })
    const cart = await this.cartService.findCart(session.cartId, { tenantId, storeId })
    if (cart.status !== 'ACTIVE') throw new BadRequestException('Carrinho nao esta ativo para checkout.')
    if (cart.items.length === 0) throw new BadRequestException('Carrinho deve conter ao menos um item.')

    const itemCount = this.cartItemCount(cart)
    const stock = await this.buildStockSnapshot({ tenantId, storeId }, cart)
    const deliveryBase = await this.resolveDelivery(
      { tenantId, storeId },
      dto,
      itemCount,
      session,
      session.customerId || cart.customerId || dto.customerId,
    )
    let price = await this.pricingService.quote({
      tenantId,
      storeId,
      channel: 'STOREFRONT',
      customerId: dto.customerId || session.customerId || cart.customerId || undefined,
      couponCode: dto.couponCode,
      deliveryAmount: Number(deliveryBase.fee || 0),
      items: cart.items.map((item) => ({ productId: item.productId, quantity: Number(item.quantity) })),
    })
    let delivery = this.applyOrderMinimum(this.applyFreeAbove(deliveryBase, price.subtotal), price.subtotal)
    if (Number(delivery.fee || 0) !== Number(deliveryBase.fee || 0)) {
      price = await this.pricingService.quote({
        tenantId,
        storeId,
        channel: 'STOREFRONT',
        customerId: dto.customerId || session.customerId || cart.customerId || undefined,
        couponCode: dto.couponCode,
        deliveryAmount: Number(delivery.fee || 0),
        items: cart.items.map((item) => ({ productId: item.productId, quantity: Number(item.quantity) })),
      })
      delivery = this.applyOrderMinimum(delivery, price.subtotal)
    }

    const blockers = this.getBlockers(stock, delivery)
    let canConfirm = blockers.length === 0
    let slotState = {
      slotId: session.fulfillmentSlotId || null,
      reserved: Boolean(session.fulfillmentSlotReserved),
      itemCount: Number(session.fulfillmentSlotItemCount || 0),
    }

    if (options.persist) {
      try {
        slotState = await this.syncFulfillmentSlotReservation({
          session,
          context: { tenantId, storeId },
          delivery,
          itemCount,
          canConfirm,
        })
      } catch (error) {
        delivery = {
          ...delivery,
          validSlot: false,
          slot: {
            ...delivery.slot,
            reason: this.errorMessage(error),
          },
        }
        blockers.push('janela de entrega/retirada sem capacidade')
        canConfirm = false
      }
    }

    const priceSnapshot = this.priceSnapshot(price)
    const updated = options.persist
      ? await this.prisma.checkoutSession.update({
          where: { id: session.id },
          data: {
            status: 'PRICED',
            customerId: dto.customerId || session.customerId || cart.customerId,
            priceSnapshot,
            deliverySnapshot: delivery,
            stockSnapshot: stock,
            fulfillmentSlotId: slotState.slotId,
            fulfillmentSlotReserved: slotState.reserved,
            fulfillmentSlotItemCount: slotState.itemCount,
          },
        })
      : session

    if (options.persist) {
      await this.recordEvent({
        tenantId,
        storeId,
        cartId: cart.id,
        checkoutSessionId: session.id,
        type: 'SESSION_QUOTED',
        customerId: dto.customerId || session.customerId || cart.customerId,
        deviceId: cart.deviceId,
        metadata: { canConfirm, blockers },
      })
    }

    return {
      session: updated,
      cart,
      price: priceSnapshot,
      delivery,
      stock,
      canConfirm,
      blockers,
    }
  }

  private async buildStockSnapshot(context: { tenantId: string; storeId: string }, cart: CartPayload): Promise<StockSnapshot> {
    const availability = await this.inventoryService.getAvailability(
      context,
      cart.items.map((item) => item.productId),
    )
    const availableByProduct = new Map(availability.items.map((item) => [item.productId, item.available]))
    const items = cart.items.map((item) => {
      const requested = Number(item.quantity)
      const available = Number(availableByProduct.get(item.productId) || 0)
      const inStock = available >= requested
      return {
        productId: item.productId,
        requested,
        available,
        inStock,
        allowSubstitution: Boolean(item.allowSubstitution),
        substitutionStatus: item.allowSubstitution ? 'ACCEPTED' as const : 'DECLINED' as const,
      }
    })

    return {
      allAvailable: items.every((item) => item.inStock),
      unavailableItems: items.filter((item) => !item.inStock).map((item) => ({
        productId: item.productId,
        requested: item.requested,
        available: item.available,
      })),
      items,
    }
  }

  private async resolveDelivery(
    context: { tenantId: string; storeId: string },
    dto: QuoteCheckoutSessionDto,
    itemCount: number,
    session: SessionRecord,
    customerId?: string | null,
  ): Promise<DeliverySnapshot> {
    const delivery = dto.delivery || {}
    const mode = String(delivery.mode || 'DELIVERY').toUpperCase()
    const fulfillmentType = mode === 'RETIRADA' ? 'PICKUP' : mode
    const slot = {
      id: this.optionalString(delivery.slotId),
      windowStart: this.optionalString(delivery.windowStart),
      windowEnd: this.optionalString(delivery.windowEnd),
      type: fulfillmentType,
      availableOrders: null as number | null,
      availableItems: null as number | null,
      reason: null as string | null,
    }
    const slotValidation = await this.deliveryService.validateSlotCapacity(
      context,
      slot.id,
      fulfillmentType,
      itemCount,
      {
        reservedOrdersOffset: session.fulfillmentSlotReserved && session.fulfillmentSlotId === slot.id ? 1 : 0,
        reservedItemsOffset: session.fulfillmentSlotReserved && session.fulfillmentSlotId === slot.id
          ? Number(session.fulfillmentSlotItemCount || 0)
          : 0,
      },
    )
    const validatedSlot = {
      ...slot,
      availableOrders: slotValidation.occupancy?.availableOrders ?? null,
      availableItems: slotValidation.occupancy?.availableItems ?? null,
      reason: slotValidation.reason || null,
    }

    if (fulfillmentType === 'PICKUP') {
      return {
        mode: 'PICKUP',
        fee: 0,
        rawFee: 0,
        freeAbove: null,
        minimumOrder: null,
        minimumOrderMet: true,
        zoneName: null,
        zoneId: null,
        isFree: true,
        outOfArea: false,
        validSlot: slotValidation.valid,
        addressId: null,
        zipCode: null,
        slot: validatedSlot,
      }
    }

    const addressId = this.optionalString(delivery.addressId || dto.deliveryAddressId)
    const address = addressId
      ? await this.prisma.address.findFirst({
          where: {
            id: addressId,
            tenantId: context.tenantId,
            ...(customerId ? { customerId } : {}),
          },
        })
      : null

    if (addressId && !address) throw new BadRequestException('Endereco de entrega nao encontrado para o checkout.')

    const cep = this.optionalString(delivery.cep || delivery.zipCode || address?.zipCode)
    const lat = typeof delivery.lat === 'number' && Number.isFinite(delivery.lat) ? delivery.lat : undefined
    const lng = typeof delivery.lng === 'number' && Number.isFinite(delivery.lng) ? delivery.lng : undefined
    const calculation = await this.deliveryService.calculate({ tenantId: context.tenantId, storeId: context.storeId, cep: cep || undefined, lat, lng })

    return {
      mode: 'DELIVERY',
      fee: calculation.fee,
      rawFee: calculation.rawFee ?? calculation.fee,
      freeAbove: calculation.freeAbove,
      minimumOrder: calculation.minimumOrder ?? null,
      minimumOrderMet: calculation.minimumOrderMet ?? true,
      zoneName: calculation.zoneName,
      zoneId: calculation.zoneId,
      isFree: calculation.isFree,
      outOfArea: calculation.outOfArea,
      validSlot: slotValidation.valid,
      addressId,
      zipCode: cep,
      slot: validatedSlot,
    }
  }

  private applyFreeAbove(delivery: DeliverySnapshot, subtotal: number): DeliverySnapshot {
    if (delivery.mode !== 'DELIVERY' || delivery.outOfArea || delivery.freeAbove == null) return delivery
    if (subtotal < delivery.freeAbove) return delivery
    return {
      ...delivery,
      fee: 0,
      isFree: true,
    }
  }

  private applyOrderMinimum(delivery: DeliverySnapshot, subtotal: number): DeliverySnapshot {
    if (delivery.mode !== 'DELIVERY' || delivery.outOfArea || delivery.minimumOrder == null) return delivery
    return {
      ...delivery,
      minimumOrderMet: subtotal >= delivery.minimumOrder,
    }
  }

  private getBlockers(stock: StockSnapshot, delivery: DeliverySnapshot) {
    const blockers: string[] = []
    if (!stock.allAvailable) blockers.push('itens indisponiveis em estoque')
    if (delivery.outOfArea) blockers.push('endereco fora da area de entrega')
    if (!delivery.minimumOrderMet) blockers.push('pedido abaixo do minimo da area de entrega')
    if (!delivery.validSlot) blockers.push('janela de entrega/retirada invalida')
    return blockers
  }

  private async syncFulfillmentSlotReservation({
    session,
    context,
    delivery,
    itemCount,
    canConfirm,
  }: {
    session: SessionRecord
    context: { tenantId: string; storeId: string }
    delivery: DeliverySnapshot
    itemCount: number
    canConfirm: boolean
  }) {
    const currentSlotId = session.fulfillmentSlotId || null
    const currentReserved = Boolean(session.fulfillmentSlotReserved)
    const currentItemCount = Number(session.fulfillmentSlotItemCount || 0)
    const nextSlotId = delivery.slot.id || null

    if (!canConfirm || !nextSlotId) {
      if (currentReserved && currentSlotId) {
        await this.deliveryService.releaseSlotReservation(context, currentSlotId, currentItemCount, 'Checkout sem confirmacao')
      }
      return { slotId: null, reserved: false, itemCount: 0 }
    }

    if (currentReserved && currentSlotId === nextSlotId) {
      return { slotId: currentSlotId, reserved: true, itemCount: currentItemCount || itemCount }
    }

    if (currentReserved && currentSlotId) {
      await this.deliveryService.releaseSlotReservation(context, currentSlotId, currentItemCount, 'Troca de janela no checkout')
    }

    await this.deliveryService.reserveSlotForCheckout(context, nextSlotId, delivery.mode, itemCount)
    return { slotId: nextSlotId, reserved: true, itemCount }
  }

  private async releaseSessionSlotReservation(session: SessionRecord, context: { tenantId: string; storeId: string }, reason: string) {
    if (!session.fulfillmentSlotReserved || !session.fulfillmentSlotId) return null
    return this.deliveryService.releaseSlotReservation(
      context,
      session.fulfillmentSlotId,
      Number(session.fulfillmentSlotItemCount || 0),
      reason,
    )
  }

  private async findSessionOrThrow(id: string, context: { tenantId: string; storeId: string }, options?: { allowFailed?: boolean }) {
    const session = await this.prisma.checkoutSession.findFirst({
      where: { id, tenantId: context.tenantId, storeId: context.storeId },
    })
    if (!session) throw new NotFoundException('Sessao de checkout nao encontrada.')
    if (session.status === 'FAILED' && !options?.allowFailed) {
      throw new BadRequestException('Sessao de checkout nao esta ativa.')
    }
    if (session.status !== 'COMPLETED' && session.expiresAt <= new Date()) {
      await this.prisma.checkoutSession.update({ where: { id: session.id }, data: { status: 'FAILED' } })
      await this.recordEvent({
        tenantId: context.tenantId,
        storeId: context.storeId,
        cartId: session.cartId,
        checkoutSessionId: session.id,
        type: 'SESSION_EXPIRED',
        customerId: session.customerId,
        metadata: { expiresAt: session.expiresAt.toISOString() },
      })
      throw new BadRequestException('Sessao de checkout expirada.')
    }
    return session
  }

  private priceSnapshot(price: Awaited<ReturnType<PricingService['quote']>>) {
    return {
      tenantId: price.tenantId,
      storeId: price.storeId,
      channel: price.channel,
      items: price.items,
      subtotal: price.subtotal,
      deliveryAmount: price.deliveryAmount,
      originalDeliveryAmount: price.originalDeliveryAmount,
      discountAmount: price.discountAmount,
      total: price.total,
      appliedPromotions: price.appliedPromotions,
      couponCode: price.couponCode,
      estimatedMargin: price.estimatedMargin,
    }
  }

  private buildPaymentSnapshot(paymentMethod: string) {
    const offlineMethods = new Set(['CASH', 'DINHEIRO', 'MONEY', 'CARD', 'CARD_ON_DELIVERY', 'CARTAO', 'CARTAO_ENTREGA'])
    const online = !offlineMethods.has(paymentMethod)
    return {
      method: paymentMethod,
      online,
      status: online ? 'PAYMENT_PENDING' : 'OFFLINE_CAPTURE',
      provider: online ? 'PENDING_PROVIDER' : 'STORE',
      createdAt: new Date().toISOString(),
    }
  }

  private async recordEvent(data: {
    tenantId: string
    storeId: string
    cartId?: string
    checkoutSessionId?: string
    type: string
    customerId?: string | null
    deviceId?: string | null
    metadata?: Prisma.InputJsonObject
  }) {
    await this.prisma.checkoutEvent.create({
      data: {
        tenantId: data.tenantId,
        storeId: data.storeId,
        cartId: data.cartId || null,
        checkoutSessionId: data.checkoutSessionId || null,
        type: data.type,
        customerId: data.customerId || null,
        deviceId: data.deviceId || null,
        metadata: data.metadata || Prisma.JsonNull,
      },
    })
  }

  private orderIdempotencyKey(session: SessionRecord) {
    return `checkout:${session.idempotencyKey}`
  }

  private expiresAt(ttlMinutes: number) {
    return new Date(Date.now() + Math.max(1, ttlMinutes) * 60 * 1000)
  }

  private resolveContext(context?: CheckoutContext) {
    return {
      tenantId: context?.tenantId || DEFAULT_TENANT_ID,
      storeId: context?.storeId || DEFAULT_STORE_ID,
    }
  }

  private cartItemCount(cart: CartPayload) {
    return cart.items.reduce((sum, item) => sum + Math.ceil(Number(item.quantity || 0)), 0)
  }

  private optionalString(value?: string | null) {
    const normalized = String(value || '').trim()
    return normalized || null
  }

  private toSessionPayload(session: SessionRecord) {
    return session
  }

  private errorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error || 'Erro desconhecido')
  }
}
