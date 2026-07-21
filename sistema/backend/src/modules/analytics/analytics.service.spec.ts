import { AnalyticsService } from './analytics.service'

const mockPrisma: any = {
  analyticsEvent: {
    create: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    groupBy: jest.fn(),
  },
  order: {
    count: jest.fn(),
    findMany: jest.fn(),
  },
  orderItem: {
    findMany: jest.fn(),
  },
  stockPosition: {
    findMany: jest.fn(),
  },
  pickingTask: {
    findMany: jest.fn(),
  },
  integrationJob: {
    findMany: jest.fn(),
  },
  integrationDeadLetter: {
    findMany: jest.fn(),
  },
  customerProfile: {
    findMany: jest.fn(),
  },
  paymentTransaction: {
    findMany: jest.fn(),
  },
  metricSnapshot: {
    deleteMany: jest.fn(),
    createMany: jest.fn(),
    findMany: jest.fn(),
  },
  categoryClassificationMapping: {
    findMany: jest.fn(),
  },
  product: {
    findMany: jest.fn(),
  },
  alertRule: {
    findMany: jest.fn(),
  },
  alertTriggered: {
    create: jest.fn(),
  },
}

describe('AnalyticsService BI foundation', () => {
  let service: AnalyticsService

  beforeEach(() => {
    jest.clearAllMocks()
    service = new AnalyticsService(mockPrisma)
  })

  it('records standardized analytics events by tenant, store, channel and session', async () => {
    mockPrisma.analyticsEvent.create.mockResolvedValue({ id: 'event-1' })

    await service.trackEvent({
      tenantId: 'tenant-1',
      storeId: 'store-1',
      type: 'VIEW_PRODUCT',
      entity: 'PRODUCT',
      entityId: 'prod-1',
      channel: 'APP',
      source: 'pdp',
      sessionId: 'session-1',
      customerId: 'customer-1',
      metadata: { category: 'mercearia' },
    })

    expect(mockPrisma.analyticsEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: 'tenant-1',
        storeId: 'store-1',
        channel: 'APP',
        source: 'pdp',
        sessionId: 'session-1',
        metadata: JSON.stringify({ category: 'mercearia' }),
      }),
    })
  })

  it('generates executive, funnel and operational metric snapshots', async () => {
    mockPrisma.order.findMany.mockResolvedValue([
      {
        id: 'order-1',
        storeId: 'store-1',
        channel: 'STOREFRONT',
        total: 120,
        status: 'COMPLETED',
        createdAt: new Date(),
        items: [],
      },
      {
        id: 'order-2',
        storeId: 'store-1',
        channel: 'WHATSAPP',
        total: 80,
        status: 'PENDING',
        createdAt: new Date(),
        items: [],
      },
    ])
    mockPrisma.analyticsEvent.findMany.mockResolvedValue([
      { type: 'VIEW_PRODUCT', channel: 'STOREFRONT', entity: 'PRODUCT', entityId: 'prod-1', metadata: null, createdAt: new Date() },
      { type: 'ADD_TO_CART', channel: 'STOREFRONT', entity: 'PRODUCT', entityId: 'prod-1', metadata: null, createdAt: new Date() },
      { type: 'SEARCH', channel: 'STOREFRONT', entity: 'SEARCH', entityId: null, metadata: JSON.stringify({ query: 'arroz', resultCount: 0 }), createdAt: new Date() },
    ])
    mockPrisma.orderItem.findMany.mockResolvedValue([
      {
        productId: 'prod-1',
        subtotal: 20,
        finalSubtotal: null,
        status: 'CUT',
        product: { category: 'MERCEARIA' },
        order: { channel: 'STOREFRONT', status: 'COMPLETED' },
      },
      {
        productId: 'prod-2',
        subtotal: 30,
        finalSubtotal: 30,
        status: 'SUBSTITUTED',
        product: { category: 'HORTIFRUTI' },
        order: { channel: 'WHATSAPP', status: 'PENDING' },
      },
    ])
    mockPrisma.stockPosition.findMany.mockResolvedValue([{ storeId: 'store-1', productId: 'prod-1', available: 0 }])
    mockPrisma.pickingTask.findMany.mockResolvedValue([
      { id: 'task-1', status: 'PENDING', slaDueAt: new Date(Date.now() - 60_000), startedAt: null, completedAt: null },
      { id: 'task-2', status: 'COMPLETED', slaDueAt: null, startedAt: new Date('2026-05-27T10:00:00Z'), completedAt: new Date('2026-05-27T10:30:00Z') },
    ])
    mockPrisma.integrationJob.findMany.mockResolvedValue([{ status: 'FAILED', type: 'STOCK_SYNC', error: 'timeout' }])
    mockPrisma.integrationDeadLetter.findMany.mockResolvedValue([{ reason: 'max_attempts', lastError: 'timeout' }])
    mockPrisma.customerProfile.findMany.mockResolvedValue([
      { customerId: 'customer-1', ltv: 200, orderCount: 3, lastOrderAt: new Date('2026-03-01T00:00:00Z'), churnRiskScore: 80 },
    ])
    mockPrisma.paymentTransaction.findMany.mockResolvedValue([
      { provider: 'PIX', method: 'PIX', status: 'FAILED', amount: 50 },
      { provider: 'PIX', method: 'PIX', status: 'PAID', amount: 120 },
    ])
    mockPrisma.metricSnapshot.deleteMany.mockResolvedValue({ count: 0 })
    mockPrisma.metricSnapshot.createMany.mockResolvedValue({ count: 1 })

    const result = await service.generateMetricSnapshots({ tenantId: 'tenant_default', storeId: 'store-1', days: 7 })

    const rows = mockPrisma.metricSnapshot.createMany.mock.calls[0][0].data
    expect(result.created).toBeGreaterThan(20)
    expect(rows).toEqual(expect.arrayContaining([
      expect.objectContaining({ dashboard: 'EXECUTIVE', metric: 'GMV', value: 200 }),
      expect.objectContaining({ dashboard: 'EXECUTIVE', metric: 'AVERAGE_TICKET', value: 100 }),
      expect.objectContaining({ dashboard: 'FUNNEL', metric: 'NO_RESULT_SEARCHES', value: 1 }),
      expect.objectContaining({ dashboard: 'RUPTURE', metric: 'LOST_SALES_BY_PRODUCT', value: 20, productId: 'prod-1' }),
      expect.objectContaining({ dashboard: 'PICKING', metric: 'DELAYED_PICKING_TASKS', value: 1 }),
      expect.objectContaining({ dashboard: 'INTEGRATIONS', metric: 'INTEGRATION_FAILURES', value: 2 }),
      expect.objectContaining({ dashboard: 'CRM', metric: 'INACTIVE_CUSTOMERS', value: 1 }),
      expect.objectContaining({ dashboard: 'PAYMENTS', metric: 'PAYMENT_FAILURES', value: 1 }),
    ]))
  })

  it('returns persona views and drill-down from metric snapshots', async () => {
    mockPrisma.metricSnapshot.findMany
      .mockResolvedValueOnce([
        { dashboard: 'RUPTURE', metric: 'LOST_SALES_BY_PRODUCT', value: 55 },
        { dashboard: 'PICKING', metric: 'DELAYED_PICKING_TASKS', value: 2 },
        { dashboard: 'INTEGRATIONS', metric: 'INTEGRATION_FAILURES', value: 1 },
        { dashboard: 'CRM', metric: 'INACTIVE_CUSTOMERS', value: 10 },
      ])
      .mockResolvedValueOnce([{ metric: 'GMV', dimension: 'CHANNEL', dimensionValue: 'APP', value: 100 }])

    const dashboard = await service.getOperationalDashboard({ tenantId: 'tenant_default', storeId: 'store-1' })
    expect(dashboard.personas.manager).toHaveLength(1)
    expect(dashboard.personas.operator).toHaveLength(1)
    expect(dashboard.personas.tech).toHaveLength(1)
    expect(dashboard.personas.marketing).toHaveLength(1)

    const drilldown = await service.drillDownMetric({ metric: 'gmv', dimension: 'channel', channel: 'APP' })
    expect(mockPrisma.metricSnapshot.findMany).toHaveBeenLastCalledWith(expect.objectContaining({
      where: expect.objectContaining({ metric: 'GMV', dimension: 'CHANNEL', channel: 'APP' }),
    }))
    expect(drilldown.data[0].dimensionValue).toBe('APP')
  })
})
