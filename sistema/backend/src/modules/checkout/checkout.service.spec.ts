import { CheckoutService } from './checkout.service'

describe('CheckoutService', () => {
  const baseSession = {
    id: 'session-1',
    tenantId: 'tenant_default',
    storeId: 'store_default',
    cartId: 'cart-1',
    customerId: 'customer-1',
    idempotencyKey: 'idem-checkout',
    status: 'STARTED',
    priceSnapshot: null,
    deliverySnapshot: null,
    stockSnapshot: null,
    paymentSnapshot: null,
    orderId: null,
    fulfillmentSlotId: null,
    fulfillmentSlotReserved: false,
    fulfillmentSlotItemCount: 0,
    expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  const baseCart = {
    id: 'cart-1',
    tenantId: 'tenant_default',
    storeId: 'store_default',
    customerId: 'customer-1',
    deviceId: 'device-1',
    status: 'ACTIVE',
    createdAt: new Date(),
    updatedAt: new Date(),
    items: [
      {
        id: 'cart-item-1',
        cartId: 'cart-1',
        productId: 'prod-1',
        quantity: 2,
        notes: 'maduro',
        allowSubstitution: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
  }

  const mockPrisma = {
    checkoutSession: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    address: {
      findFirst: jest.fn(),
    },
    checkoutEvent: {
      create: jest.fn(),
    },
    analyticsEvent: {
      create: jest.fn(),
    },
  }

  const mockCartService = {
    findCart: jest.fn(),
    markConverted: jest.fn(),
  }

  const mockPricingService = {
    quote: jest.fn(),
  }

  const mockInventoryService = {
    getAvailability: jest.fn(),
    releaseReservationsByCart: jest.fn(),
  }

  const mockDeliveryService = {
    calculate: jest.fn(),
    validateSlotCapacity: jest.fn(),
    reserveSlotForCheckout: jest.fn(),
    releaseSlotReservation: jest.fn(),
  }

  const mockOrdersService = {
    findOne: jest.fn(),
    create: jest.fn(),
  }

  let service: CheckoutService

  beforeEach(() => {
    jest.clearAllMocks()
    service = new CheckoutService(
      mockPrisma as any,
      mockCartService as any,
      mockPricingService as any,
      mockInventoryService as any,
      mockDeliveryService as any,
      mockOrdersService as any,
    )

    mockCartService.findCart.mockResolvedValue(baseCart)
    mockCartService.markConverted.mockResolvedValue({ count: 1 })
    mockPrisma.checkoutSession.findFirst.mockResolvedValue(baseSession)
    mockPrisma.checkoutSession.findUnique.mockResolvedValue(null)
    mockPrisma.checkoutSession.create.mockResolvedValue(baseSession)
    mockPrisma.checkoutSession.update.mockImplementation(async ({ data }: any) => ({ ...baseSession, ...data }))
    mockPrisma.checkoutEvent.create.mockResolvedValue({ id: 'event-1' })
    mockPrisma.analyticsEvent.create.mockResolvedValue({ id: 'analytics-1' })
    mockInventoryService.getAvailability.mockResolvedValue({
      tenantId: 'tenant_default',
      storeId: 'store_default',
      items: [{ productId: 'prod-1', available: 10 }],
    })
    mockInventoryService.releaseReservationsByCart.mockResolvedValue({ count: 0 })
    mockDeliveryService.calculate.mockResolvedValue({
      fee: 7,
      rawFee: 7,
      freeAbove: null,
      minimumOrder: null,
      minimumOrderMet: true,
      zoneName: 'Centro',
      zoneId: 'zone-1',
      isFree: false,
      outOfArea: false,
    })
    mockDeliveryService.validateSlotCapacity.mockImplementation(async (_context: any, slotId?: string | null) => ({
      valid: Boolean(slotId),
      reason: slotId ? null : 'SLOT_REQUIRED',
      slot: slotId ? { id: slotId } : null,
      occupancy: slotId ? { availableOrders: 8, availableItems: null } : null,
    }))
    mockDeliveryService.reserveSlotForCheckout.mockResolvedValue({ id: 'slot-1' })
    mockDeliveryService.releaseSlotReservation.mockResolvedValue({ id: 'slot-1' })
    mockPricingService.quote.mockResolvedValue({
      tenantId: 'tenant_default',
      storeId: 'store_default',
      channel: 'STOREFRONT',
      items: [{ productId: 'prod-1', quantity: 2, unitPrice: 10, subtotal: 20 }],
      subtotal: 20,
      deliveryAmount: 7,
      originalDeliveryAmount: 7,
      discountAmount: 0,
      total: 27,
      appliedPromotions: [],
      couponCode: null,
      estimatedMargin: null,
    })
    mockOrdersService.create.mockResolvedValue({
      order: { id: 'order-1', total: 27 },
      whatsapp: null,
    })
  })

  it('reuses an existing checkout session for the same idempotency key', async () => {
    mockPrisma.checkoutSession.findUnique.mockResolvedValue(baseSession)

    const result = await service.createSession(undefined, {
      cartId: 'cart-1',
      idempotencyKey: 'idem-checkout',
    })

    expect(result.reused).toBe(true)
    expect(mockPrisma.checkoutSession.create).not.toHaveBeenCalled()
  })

  it('quotes stock and substitution preference per item before payment', async () => {
    mockInventoryService.getAvailability.mockResolvedValue({
      tenantId: 'tenant_default',
      storeId: 'store_default',
      items: [{ productId: 'prod-1', available: 1 }],
    })

    const result = await service.quoteSession(undefined, 'session-1', {
      delivery: { cep: '01001000', slotId: 'slot-1' },
    })

    expect(result.canConfirm).toBe(false)
    expect(result.stock.unavailableItems).toEqual([{ productId: 'prod-1', requested: 2, available: 1 }])
    expect(result.stock.items[0]).toEqual(expect.objectContaining({ substitutionStatus: 'DECLINED' }))
  })

  it('blocks confirmation when delivery has no valid slot', async () => {
    await expect(
      service.confirmSession(undefined, 'session-1', {
        customerId: 'customer-1',
        paymentMethod: 'PIX',
        delivery: { cep: '01001000' },
      }),
    ).rejects.toThrow('janela de entrega')

    expect(mockOrdersService.create).not.toHaveBeenCalled()
  })

  it('creates the order with backend price, delivery and checkout idempotency', async () => {
    const result = await service.confirmSession(undefined, 'session-1', {
      customerId: 'customer-1',
      paymentMethod: 'PIX',
      couponCode: 'SAVE10',
      delivery: { cep: '01001000', slotId: 'slot-1' },
    })

    expect(mockOrdersService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: 'checkout:idem-checkout',
        delivery: 7,
        couponCode: 'SAVE10',
        fulfillmentType: 'DELIVERY',
        fulfillmentSlotId: 'slot-1',
        fulfillmentSlotItemCount: 2,
        deliveryAreaId: 'zone-1',
        items: [{ productId: 'prod-1', quantity: 2 }],
      }),
    )
    expect(mockCartService.markConverted).toHaveBeenCalledWith('cart-1', {
      tenantId: 'tenant_default',
      storeId: 'store_default',
    })
    expect(result.order.id).toBe('order-1')
  })

  it('treats CARD as offline card-on-delivery payment during checkout confirmation', async () => {
    await service.confirmSession(undefined, 'session-1', {
      customerId: 'customer-1',
      paymentMethod: 'CARD',
      delivery: { cep: '01001000', slotId: 'slot-1' },
    })

    expect(mockPrisma.checkoutSession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'session-1' },
        data: expect.objectContaining({
          status: 'RESERVED',
          paymentSnapshot: expect.objectContaining({
            method: 'CARD',
            online: false,
            status: 'OFFLINE_CAPTURE',
            provider: 'STORE',
          }),
        }),
      }),
    )
  })
})
