import { ForbiddenException } from '@nestjs/common'
import { MarketplaceService } from './marketplace.service'

const mockPrisma: any = {
  salesChannel: {
    upsert: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
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
    upsert: jest.fn(),
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
    mockPrisma.salesChannel.findFirst.mockResolvedValue({
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

  // JON-115 (Auditoria 360, High): canal sem webhookSecret configurado
  // liberava a ingestao sem exigir credencial nenhuma -- quem soubesse o
  // channelId inseria pedido. Agora recusa sempre que nao ha segredo, com
  // ou sem header.
  it('blocks external order ingestion when the channel has no secret configured at all', async () => {
    mockPrisma.salesChannel.findFirst.mockResolvedValue({
      id: 'channel-1',
      tenantId: 'tenant_default',
      storeId: 'store_default',
      type: 'IFOOD',
      provider: 'IFOOD',
      config: {}, // sem webhookSecret
    })

    await expect(service.ingestMarketplaceOrder('channel-1', {
      externalId: 'ext-1',
      items: [{ productId: 'prod-1', quantity: 1 }],
    })).rejects.toThrow(ForbiddenException)

    await expect(service.ingestMarketplaceOrder('channel-1', {
      externalId: 'ext-1',
      items: [{ productId: 'prod-1', quantity: 1 }],
    }, { 'x-marketplace-secret': 'qualquer-coisa' })).rejects.toThrow(ForbiddenException)
  })

  // JON-117 (Auditoria 360, Medium): requireChannel so exigia existir --
  // canal desativado operacionalmente continuava aceitando pedido com o
  // mesmo segredo valido.
  it('blocks external order ingestion when the channel is not ACTIVE, even with a valid secret', async () => {
    mockPrisma.salesChannel.findFirst.mockResolvedValue({
      id: 'channel-1',
      tenantId: 'tenant_default',
      storeId: 'store_default',
      type: 'IFOOD',
      provider: 'IFOOD',
      status: 'INACTIVE',
      config: { webhookSecret: 'secret' },
    })

    await expect(service.ingestMarketplaceOrder('channel-1', {
      externalId: 'ext-1',
      items: [{ productId: 'prod-1', quantity: 1 }],
    }, { 'x-marketplace-secret': 'secret' })).rejects.toThrow(ForbiddenException)

    expect(mockOrdersService.create).not.toHaveBeenCalled()
  })

  it('consolidates external marketplace order into the same OMS order service', async () => {
    mockPrisma.salesChannel.findFirst.mockResolvedValue({
      id: 'channel-1',
      tenantId: 'tenant_default',
      storeId: 'store_default',
      type: 'IFOOD',
      provider: 'IFOOD',
      status: 'ACTIVE',
      config: { webhookSecret: 'secret' },
    })
    mockPrisma.marketplaceOrder.upsert.mockResolvedValue({ id: 'mkt-1', externalId: 'ext-1', orderId: null })
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

  // JON-159 (Auditoria 360, Medium): findUnique+create tinha janela de
  // corrida -- reenvio concorrente do mesmo externalId (comum apos timeout
  // do marketplace) estourava violacao de unique como 500 cru em vez de
  // devolver a resposta idempotente. upsert resolve isso no proprio
  // Postgres; aqui confirmamos que um pedido ja consolidado (orderId
  // presente) e devolvido como duplicate sem chamar ordersService.create de
  // novo.
  it('reenvio do mesmo externalId apos ja consolidado retorna idempotente, sem recriar pedido', async () => {
    mockPrisma.salesChannel.findFirst.mockResolvedValue({
      id: 'channel-1', tenantId: 'tenant_default', storeId: 'store_default',
      type: 'IFOOD', provider: 'IFOOD', status: 'ACTIVE', config: { webhookSecret: 'secret' },
    })
    mockPrisma.marketplaceOrder.upsert.mockResolvedValue({
      id: 'mkt-1', externalId: 'ext-1', orderId: 'order-1', status: 'CONSOLIDATED',
    })

    const result = await service.ingestMarketplaceOrder('channel-1', {
      externalId: 'ext-1',
      customer: { name: 'Cliente iFood', whatsapp: '21999999999', cpf: '12345678900' },
      items: [{ externalId: 'sku-1', quantity: 2 }],
    }, { 'x-marketplace-secret': 'secret' })

    expect(result.duplicate).toBe(true)
    expect(mockOrdersService.create).not.toHaveBeenCalled()
  })

  it('surfaces marketplace dependency and margin panel by channel', async () => {
    mockPrisma.salesChannel.findMany.mockResolvedValue([
      {
        id: 'channel-1',
        type: 'IFOOD',
        provider: 'IFOOD',
        status: 'ACTIVE',
        products: [{ id: 'cp-1' }],
        marketplaceOrders: [{ status: 'CONSOLIDATED', orderId: 'order-1' }, { status: 'FAILED', orderId: null }],
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

  // JON-118: dois providers do MESMO type filtravam por channel.type e
  // exibiam o total combinado nos dois -- receita duplicada, margem errada.
  it('nao duplica receita entre dois providers do mesmo type', async () => {
    mockPrisma.salesChannel.findMany.mockResolvedValue([
      {
        id: 'channel-1', type: 'MARKETPLACE', provider: 'PROVIDER_A', status: 'ACTIVE',
        products: [], marketplaceOrders: [{ status: 'CONSOLIDATED', orderId: 'order-a' }],
        pricePolicies: [], stockPolicies: [],
      },
      {
        id: 'channel-2', type: 'MARKETPLACE', provider: 'PROVIDER_B', status: 'ACTIVE',
        products: [], marketplaceOrders: [{ status: 'CONSOLIDATED', orderId: 'order-b' }],
        pricePolicies: [], stockPolicies: [],
      },
    ])
    mockPrisma.order.findMany.mockImplementation(({ where }: any) => {
      const ids: string[] = where.id.in
      const all = [{ id: 'order-a', total: 100, items: [] }, { id: 'order-b', total: 50, items: [] }]
      return Promise.resolve(all.filter((o) => ids.includes(o.id)))
    })

    const panel = await service.getMarketplacePanel({ tenantId: 'tenant_default', storeId: 'store_default' })

    expect(panel.items[0].revenue).toBe(100)
    expect(panel.items[1].revenue).toBe(50)
  })
})
