import { ForbiddenException } from '@nestjs/common'
import { MarketplaceService } from './marketplace.service'

const mockPrisma: any = {
  salesChannel: {
    upsert: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
  channelProduct: {
    upsert: jest.fn(),
    findFirst: jest.fn(),
  },
  channelPricePolicy: {
    upsert: jest.fn(),
  },
  channelStockPolicy: {
    upsert: jest.fn(),
  },
  marketplaceOrder: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  product: {
    findFirst: jest.fn(),
  },
  customer: {
    findFirst: jest.fn(),
    create: jest.fn(),
  },
  order: {
    findMany: jest.fn(),
  },
}

const mockOrdersService: any = {
  create: jest.fn(),
}

describe('MarketplaceService', () => {
  let service: MarketplaceService

  beforeEach(() => {
    jest.clearAllMocks()
    service = new MarketplaceService(mockPrisma, mockOrdersService)
  })

  it('creates sales channel governance records with normalized type and provider', async () => {
    mockPrisma.salesChannel.upsert.mockResolvedValue({ id: 'channel-1', type: 'IFOOD', provider: 'IFOOD' })

    await service.upsertSalesChannel({
      tenantId: 'tenant_default',
      storeId: 'store_default',
      type: 'ifood',
      provider: 'ifood',
      name: 'iFood',
      config: { webhookSecret: 'secret' },
    })

    expect(mockPrisma.salesChannel.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { tenantId_storeId_type_provider: { tenantId: 'tenant_default', storeId: 'store_default', type: 'IFOOD', provider: 'IFOOD' } },
      create: expect.objectContaining({ type: 'IFOOD', provider: 'IFOOD', name: 'iFood' }),
    }))
  })

  it('blocks external order ingestion when channel secret is wrong', async () => {
    mockPrisma.salesChannel.findUnique.mockResolvedValue({
      id: 'channel-1',
      tenantId: 'tenant_default',
      storeId: 'store_default',
      type: 'IFOOD',
      provider: 'IFOOD',
      config: { webhookSecret: 'expected' },
    })

    await expect(service.ingestMarketplaceOrder('channel-1', {
      externalId: 'ext-1',
      items: [{ productId: 'prod-1', quantity: 1 }],
    }, { 'x-marketplace-secret': 'wrong' })).rejects.toThrow(ForbiddenException)
  })

  it('consolidates external marketplace order into the same OMS order service', async () => {
    mockPrisma.salesChannel.findUnique.mockResolvedValue({
      id: 'channel-1',
      tenantId: 'tenant_default',
      storeId: 'store_default',
      type: 'IFOOD',
      provider: 'IFOOD',
      config: { webhookSecret: 'secret' },
    })
    mockPrisma.marketplaceOrder.findUnique.mockResolvedValue(null)
    mockPrisma.marketplaceOrder.create.mockResolvedValue({ id: 'mkt-1', externalId: 'ext-1' })
    mockPrisma.customer.findFirst.mockResolvedValue({ id: 'customer-1' })
    mockPrisma.channelProduct.findFirst.mockResolvedValue({ productId: 'prod-1' })
    mockOrdersService.create.mockResolvedValue({ order: { id: 'order-1', status: 'PENDING' } })
    mockPrisma.marketplaceOrder.update.mockResolvedValue({ id: 'mkt-1', orderId: 'order-1', status: 'CONSOLIDATED' })

    const result = await service.ingestMarketplaceOrder('channel-1', {
      externalId: 'ext-1',
      customer: { name: 'Cliente iFood', whatsapp: '21999999999', cpf: '12345678900' },
      items: [{ externalId: 'sku-1', quantity: 2 }],
      delivery: 5,
      paymentMethod: 'IFOOD',
    }, { 'x-marketplace-secret': 'secret' })

    expect(mockOrdersService.create).toHaveBeenCalledWith(expect.objectContaining({
      channel: 'IFOOD',
      idempotencyKey: 'marketplace:channel-1:ext-1',
      items: [{ productId: 'prod-1', quantity: 2 }],
    }))
    expect(result.marketplaceOrder.status).toBe('CONSOLIDATED')
  })

  it('surfaces marketplace dependency and margin panel by channel', async () => {
    mockPrisma.salesChannel.findMany.mockResolvedValue([
      {
        id: 'channel-1',
        type: 'IFOOD',
        provider: 'IFOOD',
        status: 'ACTIVE',
        products: [{ id: 'cp-1' }],
        marketplaceOrders: [{ status: 'CONSOLIDATED' }, { status: 'FAILED' }],
        pricePolicies: [{ id: 'price-policy-1' }],
        stockPolicies: [{ id: 'stock-policy-1' }],
      },
    ])
    mockPrisma.order.findMany.mockResolvedValue([{ total: 100, items: [] }])

    const panel = await service.getMarketplacePanel({ tenantId: 'tenant_default', storeId: 'store_default' })

    expect(panel.items[0]).toEqual(expect.objectContaining({
      type: 'IFOOD',
      failedOrders: 1,
      revenue: 100,
      estimatedMargin: 10,
    }))
    expect(panel.dependencyPanel[0].failing).toBe(true)
  })
})
