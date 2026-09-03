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
    // buildStockSnapshot le syncOption/stock pra decidir se o produto e
    // VENDAVEL (ver common/product-availability.ts). Nao pode devolver lista
    // vazia: produto ausente do banco significa item de carrinho apontando pra
    // nada, e o checkout barra -- de proposito.
    product: {
      findMany: jest.fn().mockResolvedValue([
        { id: 'prod-1', syncOption: 'ESTOQUE', stock: 10, active: true },
      ]),
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
    // priceSnapshot com o mesmo total do mock de pricing abaixo (27), simulando
    // uma sessao que ja passou por quoteSession antes de confirmar (fluxo real).
    mockPrisma.checkoutSession.findFirst.mockResolvedValue({ ...baseSession, priceSnapshot: { total: 27 } })
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

  // Decisao do lojista (02/09/2026): o estoque do ERP governa EXIBICAO, nao
  // limite de quantidade. Ate entao o cliente montava o pedido inteiro e
  // levava "alguns itens ficaram indisponiveis" so no fim -- caso real: vinho
  // com 3 em estoque, pediu 6. Quando falta de verdade, quem resolve e o
  // separador, com a politica de substituicao escolhida pelo cliente.
  it('pedir mais do que o estoque disponivel NAO bloqueia o checkout', async () => {
    mockInventoryService.getAvailability.mockResolvedValue({
      tenantId: 'tenant_default',
      storeId: 'store_default',
      items: [{ productId: 'prod-1', available: 1 }],
    })

    const result = await service.quoteSession(undefined, 'session-1', {
      delivery: { cep: '01001000', slotId: 'slot-1' },
    })

    expect(result.stock.unavailableItems).toEqual([])
    expect(result.canConfirm).toBe(true)
    // A preferencia de substituicao do item continua sendo transportada: e o
    // que o separador le quando o produto realmente falta.
    expect(result.stock.items[0]).toEqual(expect.objectContaining({ substitutionStatus: 'DECLINED' }))
  })

  it('produto que deixou de ser vendavel no meio do caminho bloqueia', async () => {
    mockPrisma.product.findMany.mockResolvedValueOnce([
      { id: 'prod-1', syncOption: 'ESTOQUE', stock: 0, active: true },
    ])
    mockInventoryService.getAvailability.mockResolvedValue({
      tenantId: 'tenant_default',
      storeId: 'store_default',
      items: [{ productId: 'prod-1', available: 0 }],
    })

    const result = await service.quoteSession(undefined, 'session-1', {
      delivery: { cep: '01001000', slotId: 'slot-1' },
    })

    expect(result.canConfirm).toBe(false)
    expect(result.stock.unavailableItems).toEqual([{ productId: 'prod-1', requested: 2, available: 0 }])
  })

  it('SEMPRE com estoque negativo continua vendavel', async () => {
    mockPrisma.product.findMany.mockResolvedValueOnce([
      { id: 'prod-1', syncOption: 'SEMPRE', stock: -2897, active: true },
    ])
    mockInventoryService.getAvailability.mockResolvedValue({
      tenantId: 'tenant_default',
      storeId: 'store_default',
      items: [{ productId: 'prod-1', available: -2897 }],
    })

    const result = await service.quoteSession(undefined, 'session-1', {
      delivery: { cep: '01001000', slotId: 'slot-1' },
    })

    expect(result.stock.unavailableItems).toEqual([])
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

  describe('trava de divergencia de preco (confirmSession)', () => {
    it('confirma normalmente quando o total exibido bate com o recalculado', async () => {
      mockPrisma.checkoutSession.findFirst.mockResolvedValue({
        ...baseSession,
        priceSnapshot: { total: 27 },
      })

      const result = await service.confirmSession(undefined, 'session-1', {
        customerId: 'customer-1',
        paymentMethod: 'PIX',
        delivery: { cep: '01001000', slotId: 'slot-1' },
      })

      expect(result.order.id).toBe('order-1')
      expect(mockPrisma.checkoutEvent.create).not.toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ type: 'PRICE_DIVERGED' }) }),
      )
    })

    it('bloqueia com 400 e loga PRICE_DIVERGED quando a diferenca passa de 1 centavo', async () => {
      mockPrisma.checkoutSession.findFirst.mockResolvedValue({
        ...baseSession,
        priceSnapshot: { total: 27.5 },
      })

      await expect(
        service.confirmSession(undefined, 'session-1', {
          customerId: 'customer-1',
          paymentMethod: 'PIX',
          delivery: { cep: '01001000', slotId: 'slot-1' },
        }),
      ).rejects.toMatchObject({ status: 400 })

      expect(mockPrisma.checkoutEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'PRICE_DIVERGED',
            metadata: expect.objectContaining({ shownTotal: 27.5, confirmedTotal: 27 }),
          }),
        }),
      )
      expect(mockOrdersService.create).not.toHaveBeenCalled()
    })

    it('confirma quando a diferenca esta dentro da tolerancia de 1 centavo', async () => {
      mockPrisma.checkoutSession.findFirst.mockResolvedValue({
        ...baseSession,
        priceSnapshot: { total: 27.005 },
      })

      const result = await service.confirmSession(undefined, 'session-1', {
        customerId: 'customer-1',
        paymentMethod: 'PIX',
        delivery: { cep: '01001000', slotId: 'slot-1' },
      })

      expect(result.order.id).toBe('order-1')
      expect(mockPrisma.checkoutEvent.create).not.toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ type: 'PRICE_DIVERGED' }) }),
      )
    })

    it('bloqueia confirmacao quando priceSnapshot esta ausente (cliente nao chamou quote antes)', async () => {
      // priceSnapshot null (default do baseSession): numericTotal() retorna null.
      // Antes essa trava era pulada silenciosamente (nada pra comparar); agora exige
      // quote previo -- ver checkout.service.ts.
      mockPrisma.checkoutSession.findFirst.mockResolvedValue({
        ...baseSession,
        priceSnapshot: null,
      })

      await expect(
        service.confirmSession(undefined, 'session-1', {
          customerId: 'customer-1',
          paymentMethod: 'PIX',
          delivery: { cep: '01001000', slotId: 'slot-1' },
        }),
      ).rejects.toThrow('Cotacao nao encontrada')
      expect(mockOrdersService.create).not.toHaveBeenCalled()
    })

    it('bloqueia confirmacao quando priceSnapshot esta malformado (total nao numerico)', async () => {
      mockPrisma.checkoutSession.findFirst.mockResolvedValue({
        ...baseSession,
        priceSnapshot: { total: 'nao-e-numero' },
      })

      await expect(
        service.confirmSession(undefined, 'session-1', {
          customerId: 'customer-1',
          paymentMethod: 'PIX',
          delivery: { cep: '01001000', slotId: 'slot-1' },
        }),
      ).rejects.toThrow('Cotacao nao encontrada')
      expect(mockOrdersService.create).not.toHaveBeenCalled()
    })
  })
})
