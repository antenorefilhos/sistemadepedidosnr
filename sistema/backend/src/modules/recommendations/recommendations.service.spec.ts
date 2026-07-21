import { RecommendationsService } from './recommendations.service'

const availableProduct = {
  id: 'prod-1',
  ean: '111',
  name: 'Arroz',
  titleMask: null,
  titleMaskShort: null,
  price: 10,
  promotionalPrice: null,
  stock: 8,
  syncOption: 'ESTOQUE',
  category: 'MERCEARIA',
  classification01: '01-MERCEARIA',
  classification02: null,
  classification03: null,
  classification04: null,
  unit: 'un',
  badges: null,
  isFractional: false,
  fractionStep: null,
  active: true,
}

const mockPrisma: any = {
  orderItem: {
    findMany: jest.fn(),
    groupBy: jest.fn(),
  },
  product: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
  },
  productMaster: {
    findFirst: jest.fn(),
  },
  productSubstitution: {
    findMany: jest.fn(),
  },
  recommendationEvent: {
    create: jest.fn(),
    groupBy: jest.fn(),
  },
  analyticsEvent: {
    create: jest.fn(),
  },
  customerSegment: {
    findFirst: jest.fn(),
  },
  priceListItem: {
    findMany: jest.fn(),
  },
  orderEvent: {
    findMany: jest.fn(),
  },
}

describe('RecommendationsService', () => {
  let service: RecommendationsService

  beforeEach(() => {
    jest.clearAllMocks()
    service = new RecommendationsService(mockPrisma)
  })

  it('builds rebuy recommendations from customer history and excludes unavailable products', async () => {
    mockPrisma.orderItem.findMany.mockResolvedValue([
      { productId: 'prod-1', quantity: 2, createdAt: new Date() },
      { productId: 'prod-2', quantity: 1, createdAt: new Date() },
    ])
    mockPrisma.product.findMany.mockResolvedValue([
      availableProduct,
      { ...availableProduct, id: 'prod-2', name: 'Sem estoque', stock: 0, syncOption: 'ESTOQUE' },
    ])

    const result = await service.getRebuy('customer-1', { tenantId: 'tenant_default', storeId: 'store_default' }, 10)

    expect(result.context).toBe('REBUY')
    expect(result.items).toHaveLength(1)
    expect(result.items[0].product.id).toBe('prod-1')
  })

  it('returns complementary basket recommendations ranked by co-purchase', async () => {
    mockPrisma.orderItem.findMany
      .mockResolvedValueOnce([{ orderId: 'order-1' }, { orderId: 'order-2' }])
      .mockResolvedValueOnce([
        { productId: 'prod-2', quantity: 1 },
        { productId: 'prod-2', quantity: 1 },
        { productId: 'prod-3', quantity: 1 },
      ])
    mockPrisma.product.findMany.mockResolvedValue([
      { ...availableProduct, id: 'prod-2', name: 'Feijao', stock: 5 },
      { ...availableProduct, id: 'prod-3', name: 'Macarrao', stock: 5 },
    ])

    const result = await service.getComplementary('prod-1', { tenantId: 'tenant_default', storeId: 'store_default' }, 2)

    expect(result.context).toBe('COMPLEMENTARY')
    expect(result.items.map((item) => item.product.id)).toEqual(['prod-2', 'prod-3'])
  })

  it('filters substitutes by catalog link, category, price and availability', async () => {
    mockPrisma.product.findFirst.mockResolvedValue(availableProduct)
    mockPrisma.productMaster.findFirst.mockResolvedValue({ id: 'master-1' })
    mockPrisma.productSubstitution.findMany.mockResolvedValue([
      { priority: 1, substitute: { legacyProductId: 'prod-2' } },
      { priority: 2, substitute: { legacyProductId: 'prod-3' } },
    ])
    mockPrisma.product.findMany.mockResolvedValue([
      { ...availableProduct, id: 'prod-2', name: 'Arroz similar', price: 11, stock: 4, category: 'MERCEARIA' },
      { ...availableProduct, id: 'prod-3', name: 'Produto caro', price: 30, stock: 4, category: 'MERCEARIA' },
    ])

    const result = await service.getSubstitutes('prod-1', { tenantId: 'tenant_default', storeId: 'store_default' }, 5)

    expect(result.items).toHaveLength(1)
    expect(result.items[0].product.id).toBe('prod-2')
  })

  it('records recommendation conversion in BI events', async () => {
    mockPrisma.recommendationEvent.create.mockResolvedValue({
      id: 'rec-event-1',
      tenantId: 'tenant_default',
      storeId: 'store_default',
      customerId: 'customer-1',
      sessionId: 'session-1',
      deviceId: null,
      context: 'REBUY',
      source: 'RULES',
      productId: null,
      recommendedProductId: 'prod-1',
      orderId: null,
      cartId: 'cart-1',
    })
    mockPrisma.analyticsEvent.create.mockResolvedValue({ id: 'analytics-1' })

    await service.recordEvent({
      eventType: 'add_to_cart',
      context: 'rebuy',
      recommendedProductId: 'prod-1',
      customerId: 'customer-1',
      sessionId: 'session-1',
      cartId: 'cart-1',
    })

    expect(mockPrisma.recommendationEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ eventType: 'ADD_TO_CART', convertedAt: expect.any(Date) }),
    }))
    expect(mockPrisma.analyticsEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ type: 'RECOMMENDATION_ADD_TO_CART', entityId: 'prod-1' }),
    }))
  })
})
