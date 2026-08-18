import { DeliveryService } from './delivery.service'
import { PrismaService } from '../../common/prisma.service'

const mockPrisma = {
  deliveryArea: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  deliveryZone: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  fulfillmentSlot: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  fulfillmentEvent: {
    create: jest.fn(),
  },
  driver: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
  },
  deliveryRoute: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  deliveryStop: {
    findFirst: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  order: {
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  orderEvent: {
    create: jest.fn(),
  },
  $transaction: jest.fn((cb: any) => cb(mockPrisma)),
}

const mockNotificationsService = {
  create: jest.fn(),
}

describe('DeliveryService', () => {
  let service: DeliveryService

  beforeEach(() => {
    service = new DeliveryService(mockPrisma as unknown as PrismaService, mockNotificationsService as any)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('returns outOfArea when there are no active zones', async () => {
    mockPrisma.deliveryArea.findMany.mockResolvedValue([])
    mockPrisma.deliveryZone.findMany.mockResolvedValue([])

    await expect(service.calculate({ cep: '01001-000' })).resolves.toEqual({
      fee: null,
      rawFee: null,
      freeAbove: null,
      minimumOrder: null,
      minimumOrderMet: false,
      zoneName: null,
      zoneId: null,
      isFree: false,
      outOfArea: true,
    })
  })

  it('returns outOfArea when CEP does not match any active zone', async () => {
    mockPrisma.deliveryArea.findMany.mockResolvedValue([])
    mockPrisma.deliveryZone.findMany.mockResolvedValue([
      {
        id: 'zone-1',
        name: 'Centro',
        type: 'CEP_RANGE',
        cepStart: '01000000',
        cepEnd: '01099999',
        fee: 8,
        freeAbove: null,
      },
    ])

    const result = await service.calculate({ cep: '99999-999' })

    expect(result).toEqual(
      expect.objectContaining({
        fee: null,
        zoneId: null,
        outOfArea: true,
      }),
    )
  })

  it('uses DeliveryArea rules before legacy zones', async () => {
    mockPrisma.deliveryArea.findMany.mockResolvedValue([
      {
        id: 'area-1',
        name: 'Centro premium',
        type: 'CEP_RANGE',
        rule: { cepStart: '01000-000', cepEnd: '01099-999' },
        fee: 12,
        freeAbove: 100,
        minimumOrder: 40,
        priority: 10,
      },
    ])
    mockPrisma.deliveryZone.findMany.mockResolvedValue([])

    await expect(service.calculate({ cep: '01001-000', subtotal: 120 })).resolves.toEqual(
      expect.objectContaining({
        fee: 0,
        rawFee: 12,
        freeAbove: 100,
        minimumOrder: 40,
        minimumOrderMet: true,
        zoneName: 'Centro premium',
        zoneId: 'area-1',
        isFree: true,
        outOfArea: false,
      }),
    )
  })

  it('blocks a full fulfillment slot', async () => {
    mockPrisma.fulfillmentSlot.findFirst.mockResolvedValue({
      id: 'slot-1',
      tenantId: 'tenant_default',
      storeId: 'store_default',
      type: 'DELIVERY',
      startsAt: new Date(Date.now() + 60 * 60 * 1000),
      endsAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
      capacityOrders: 2,
      capacityItems: null,
      reservedOrders: 2,
      reservedItems: 0,
      cutoffMinutes: 0,
      status: 'ACTIVE',
    })

    await expect(service.validateSlotCapacity(undefined, 'slot-1', 'DELIVERY', 1)).resolves.toEqual(
      expect.objectContaining({
        valid: false,
        reason: 'SLOT_FULL_ORDERS',
      }),
    )
  })

  it('reserves and releases slot capacity', async () => {
    const slot = {
      id: 'slot-1',
      tenantId: 'tenant_default',
      storeId: 'store_default',
      type: 'PICKUP',
      startsAt: new Date(Date.now() + 60 * 60 * 1000),
      endsAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
      capacityOrders: 3,
      capacityItems: 10,
      reservedOrders: 1,
      reservedItems: 2,
      cutoffMinutes: 0,
      status: 'ACTIVE',
    }
    mockPrisma.fulfillmentSlot.findFirst.mockResolvedValueOnce(slot)
    mockPrisma.fulfillmentSlot.update.mockResolvedValueOnce({ ...slot, reservedOrders: 2, reservedItems: 5 })
    mockPrisma.fulfillmentEvent.create.mockResolvedValue({ id: 'event-1' })

    await service.reserveSlotForCheckout(undefined, 'slot-1', 'PICKUP', 3)

    expect(mockPrisma.fulfillmentSlot.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'slot-1' },
        data: expect.objectContaining({
          reservedOrders: { increment: 1 },
          reservedItems: { increment: 3 },
        }),
      }),
    )

    mockPrisma.fulfillmentSlot.findFirst.mockResolvedValueOnce({ ...slot, reservedOrders: 2, reservedItems: 5 })
    // A liberacao roda dentro de $transaction e le o estado atual com
    // findUnique antes de descontar.
    mockPrisma.fulfillmentSlot.findUnique.mockResolvedValueOnce({ ...slot, reservedOrders: 2, reservedItems: 5 })
    mockPrisma.fulfillmentSlot.update.mockResolvedValueOnce({ ...slot, reservedOrders: 1, reservedItems: 2 })

    await service.releaseSlotReservation(undefined, 'slot-1', 3, 'teste')

    expect(mockPrisma.fulfillmentSlot.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { id: 'slot-1' },
        data: expect.objectContaining({
          reservedOrders: 1,
          reservedItems: 2,
        }),
      }),
    )
  })

  describe('getDriverPerformance', () => {
    function route(overrides: Partial<Record<string, any>> = {}) {
      return {
        id: 'route-1',
        driverId: 'driver-1',
        driver: { name: 'Fulano' },
        status: 'COMPLETED',
        startsAt: new Date('2026-01-01T10:00:00Z'),
        completedAt: new Date('2026-01-01T10:30:00Z'),
        createdAt: new Date('2026-01-01T09:00:00Z'),
        stops: [{ status: 'DELIVERED' }, { status: 'DELIVERED' }, { status: 'FAILED' }],
        ...overrides,
      }
    }

    it('aggregates routes and stops per driver', async () => {
      mockPrisma.deliveryRoute.findMany.mockResolvedValue([
        route(),
        route({ id: 'route-2', stops: [{ status: 'DELIVERED' }] }),
        route({
          id: 'route-3',
          driverId: 'driver-2',
          driver: { name: 'Ciclano' },
          stops: [{ status: 'DELIVERED' }, { status: 'DELIVERED' }],
        }),
      ])

      const result = await service.getDriverPerformance(undefined, {})

      expect(result.totals.routes).toBe(3)
      expect(result.totals.completed).toBe(3)
      expect(result.drivers).toHaveLength(2)

      const driver1 = result.drivers.find((d) => d.driverId === 'driver-1')!
      expect(driver1.driverName).toBe('Fulano')
      expect(driver1.routesCompleted).toBe(2)
      expect(driver1.stopsDelivered).toBe(3)
      expect(driver1.stopsFailed).toBe(1)
      expect(driver1.avgDeliveryMinutes).toBe(30)

      const driver2 = result.drivers.find((d) => d.driverId === 'driver-2')!
      expect(driver2.driverName).toBe('Ciclano')
      expect(driver2.stopsDelivered).toBe(2)
      expect(driver2.stopsFailed).toBe(0)
    })

    it('groups routes without a driver under "unassigned"', async () => {
      mockPrisma.deliveryRoute.findMany.mockResolvedValue([
        route({ driverId: null, driver: null, stops: [{ status: 'DELIVERED' }] }),
      ])

      const result = await service.getDriverPerformance(undefined, {})

      expect(result.drivers).toEqual([
        expect.objectContaining({ driverId: 'unassigned', driverName: 'Sem motorista', stopsDelivered: 1 }),
      ])
    })

    it('filters by period and passes it to the query', async () => {
      mockPrisma.deliveryRoute.findMany.mockResolvedValue([])

      const result = await service.getDriverPerformance(undefined, {
        from: '2026-01-01T00:00:00.000Z',
        to: '2026-01-31T00:00:00.000Z',
      })

      expect(mockPrisma.deliveryRoute.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: { gte: new Date('2026-01-01T00:00:00.000Z'), lte: new Date('2026-01-31T00:00:00.000Z') },
          }),
        }),
      )
      expect(result.period).toEqual({ from: '2026-01-01T00:00:00.000Z', to: '2026-01-31T00:00:00.000Z' })
    })

    it('scopes the query by tenant and store', async () => {
      mockPrisma.deliveryRoute.findMany.mockResolvedValue([])

      await service.getDriverPerformance({ tenantId: 'tenant-x', storeId: 'store-y' }, {})

      expect(mockPrisma.deliveryRoute.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: 'tenant-x', storeId: 'store-y' }),
        }),
      )
    })

    it('returns an empty result when there are no routes in the period', async () => {
      mockPrisma.deliveryRoute.findMany.mockResolvedValue([])

      const result = await service.getDriverPerformance(undefined, {})

      expect(result.totals).toEqual({ routes: 0, completed: 0 })
      expect(result.drivers).toEqual([])
    })
  })
})
