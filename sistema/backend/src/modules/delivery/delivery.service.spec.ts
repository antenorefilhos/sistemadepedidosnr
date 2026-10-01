import { DeliveryService } from './delivery.service'
import { PrismaService } from '../../common/prisma.service'
import pointsFixture from './delivery-points.fixture.json'

// Tabela de frete por localidade (delivery_points) com os mesmos dados que a
// migracao 20260930030000 grava -- a planilha de balcao consolidada.
const pointsByCep = (where: { cep?: string; active?: boolean }) =>
  Promise.resolve((pointsFixture as Array<{ cep: string | null; active: boolean; fee: number }>).filter((p) => p.cep === where.cep && p.active).sort((a, b) => a.fee - b.fee))

const mockPrisma = {
  brandConfig: { findUnique: jest.fn().mockResolvedValue(null) },
  deliveryPoint: {
    findMany: jest.fn(({ where }: { where: { cep?: string; active?: boolean } }) => pointsByCep(where)),
    findFirst: jest.fn(),
  },
  deliveryZone: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
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

  it('prefers a higher-priority specific CEP zone over a wide-range base zone (CEP fora da planilha de balcao, so zonas do admin)', async () => {
    // CEP inventado (fora de delivery-rates-balcao.json) pra testar so a
    // prioridade das zonas do banco, sem a planilha de balcao interferir --
    // ela e checada antes e teria prioridade sobre qualquer zona do banco.
    // Ordem igual a query real (orderBy priority desc) -- o mock nao ordena
    // sozinho, e o service usa .find() na ordem que recebe.
    mockPrisma.deliveryZone.findMany.mockResolvedValue([
      {
        id: 'zone-specifica',
        name: 'Zona especifica de teste',
        type: 'CEP_RANGE',
        cepStart: '25799990',
        cepEnd: '25799990',
        fee: 22,
        freeAbove: null,
        priority: 10,
      },
      {
        id: 'zone-base',
        name: 'Pedro do Rio (base)',
        type: 'CEP_RANGE',
        cepStart: '25700000',
        cepEnd: '25849999',
        fee: 15,
        freeAbove: null,
        priority: 1,
      },
    ])

    // CEP dentro da faixa da zona base E dentro da zona especifica --
    // a especifica (priority 10) tem que ganhar da base (priority 1).
    await expect(service.calculate({ cep: '25799-990' })).resolves.toEqual(
      expect.objectContaining({ fee: 22, zoneName: 'Zona especifica de teste', zoneId: 'zone-specifica', outOfArea: false }),
    )

    // CEP dentro so da faixa da base -- cai na base.
    await expect(service.calculate({ cep: '25710-000' })).resolves.toEqual(
      expect.objectContaining({ fee: 15, zoneName: 'Pedro do Rio (base)', zoneId: 'zone-base', outOfArea: false }),
    )
  })

  describe('tabela de frete por localidade (sistema hibrido de localidades)', () => {
    it('localidade com gratis acima de X zera o frete quando o subtotal alcanca', async () => {
      mockPrisma.deliveryZone.findMany.mockResolvedValue([])
      mockPrisma.deliveryPoint.findMany.mockResolvedValueOnce([
        { code: '4205', locality: 'Ribeirão', fee: 36, freeAbove: 150, minutes: 11, km: 9, reference: null },
      ])
      const result = await service.calculate({ cep: '25720-170', subtotal: 160 })
      expect(result).toEqual(expect.objectContaining({ fee: 0, rawFee: 36, freeAbove: 150, isFree: true, zoneId: 'balcao:4205' }))
    })

    it('localidade sem regra propria e sem global: cobra o frete', async () => {
      mockPrisma.deliveryZone.findMany.mockResolvedValue([])
      const result = await service.calculate({ cep: '25720-170', subtotal: 500 })
      expect(result.freeAbove).toBeUndefined()
      expect(result.fee).toBe(36)
    })

    it('localidade sem regra propria usa o gratis acima de global (Marca)', async () => {
      mockPrisma.deliveryZone.findMany.mockResolvedValue([])
      mockPrisma.brandConfig.findUnique.mockResolvedValueOnce({ freeShippingThreshold: 200 }).mockResolvedValueOnce({ freeShippingThreshold: 200 })
      expect(await service.calculate({ cep: '25720-170', subtotal: 150 })).toEqual(expect.objectContaining({ fee: 36, freeAbove: 200, isFree: false }))
      expect(await service.calculate({ cep: '25720-170', subtotal: 250 })).toEqual(expect.objectContaining({ fee: 0, rawFee: 36, freeAbove: 200, isFree: true }))
    })

    it('regra da localidade vence o global', async () => {
      mockPrisma.deliveryZone.findMany.mockResolvedValue([])
      mockPrisma.brandConfig.findUnique.mockResolvedValueOnce({ freeShippingThreshold: 50 })
      mockPrisma.deliveryPoint.findMany.mockResolvedValueOnce([
        { code: '4205', locality: 'Ribeirão', fee: 36, freeAbove: 150, minutes: 11, km: 9, reference: null },
      ])
      expect(await service.calculate({ cep: '25720-170', subtotal: 100 })).toEqual(expect.objectContaining({ fee: 36, freeAbove: 150, isFree: false }))
    })

    it('CEP com multiplos pontos sem locality informada retorna availableLocalities pra escolha do cliente', async () => {
      mockPrisma.deliveryZone.findMany.mockResolvedValue([])

      const result = await service.calculate({ cep: '25750-222' })

      expect(result.outOfArea).toBe(false)
      expect(result.requiresLocalitySelection).toBe(true)
      expect(result.selectedLocality).toBeNull()
      expect(result.availableLocalities?.length).toBeGreaterThan(1)
      expect(result.availableLocalities).toEqual(
        expect.arrayContaining([expect.objectContaining({ name: 'Chafariz', fee: 6 })]),
      )
    })

    it('CEP com multiplos pontos + locality CHAFARIZ aplica a taxa exata daquele ponto', async () => {
      mockPrisma.deliveryZone.findMany.mockResolvedValue([])

      const result = await service.calculate({ cep: '25750-222', locality: 'Chafariz' })

      expect(result).toEqual(
        expect.objectContaining({
          fee: 6,
          rawFee: 6,
          zoneName: 'Chafariz',
          selectedLocality: 'Chafariz',
          requiresLocalitySelection: false,
          outOfArea: false,
        }),
      )
    })

    it('CEP com multiplos pontos + locality Condominio Bosque das Mangueiras aplica a taxa do condominio, nao a do vizinho', async () => {
      mockPrisma.deliveryZone.findMany.mockResolvedValue([])

      const result = await service.calculate({ cep: '25750-222', locality: 'Condomínio Bosque das Mangueiras' })

      expect(result).toEqual(
        expect.objectContaining({
          fee: 22,
          rawFee: 22,
          zoneName: 'Condomínio Bosque das Mangueiras',
          selectedLocality: 'Condomínio Bosque das Mangueiras',
          requiresLocalitySelection: false,
        }),
      )
    })

    it('CEP com um so ponto na planilha aplica a taxa direto, sem pedir selecao', async () => {
      mockPrisma.deliveryZone.findMany.mockResolvedValue([])

      // 25720170 -- RIBEIRAO, unico ponto pra esse CEP na planilha.
      const result = await service.calculate({ cep: '25720-170' })

      expect(result).toEqual(
        expect.objectContaining({
          fee: 36,
          zoneName: 'Ribeirão',
          requiresLocalitySelection: false,
          availableLocalities: [],
        }),
      )
    })

    it('CEP sem ponto na planilha cai pro fallback de DeliveryZone (zona base regional)', async () => {
      mockPrisma.deliveryZone.findMany.mockResolvedValue([
        {
          id: 'zone-base',
          name: 'Pedro do Rio (base)',
          type: 'CEP_RANGE',
          cepStart: '25700000',
          cepEnd: '25849999',
          fee: 15,
          freeAbove: null,
          priority: 1,
        },
      ])

      // CEP dentro da faixa da base mas que nao existe na planilha.
      const result = await service.calculate({ cep: '25701-000' })

      expect(result).toEqual(
        expect.objectContaining({ fee: 15, zoneName: 'Pedro do Rio (base)', outOfArea: false }),
      )
    })

    it('GPS dentro de poligono ativo mantem prioridade espacial maxima, ignora CEP e a planilha de balcao', async () => {
      mockPrisma.deliveryZone.findMany.mockResolvedValue([
        {
          id: 'zone-chafariz-poligono',
          name: 'Chafariz',
          type: 'GEO_POLYGON',
          polygonGeoJSON: JSON.stringify({
            type: 'Polygon',
            coordinates: [
              [
                [-43.21, -22.42],
                [-43.19, -22.42],
                [-43.19, -22.40],
                [-43.21, -22.40],
                [-43.21, -22.42],
              ],
            ],
          }),
          fee: 6,
          freeAbove: 80,
          priority: 100,
        },
      ])

      // Coordenada dentro do poligono, mas CEP de um ponto caro da planilha
      // (COND. BOSQUE DAS MANGUEIRAS, R$22) -- o poligono tem que ganhar.
      const result = await service.calculate({ cep: '25750-222', lat: -22.41, lng: -43.2 })

      expect(result).toEqual(
        expect.objectContaining({ fee: 6, zoneName: 'Chafariz', outOfArea: false }),
      )
    })
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

  // JON-72 (Auditoria 360, High): as tres mutacoes (start/updateStopStatus/
  // complete) so verificavam tenant/store, nao dono -- motorista A com o
  // routeId de B (mesma loja) conseguia mexer na rota alheia.
  describe('isolamento por dono da rota (JON-72)', () => {
    it('startRoute: 404 quando a rota pertence a outro motorista', async () => {
      mockPrisma.deliveryRoute.findFirst.mockResolvedValue(null) // filtro por driverId nao acha nada

      await expect(
        service.startRoute('route-de-b', { tenantId: 'tenant_default', storeId: 'store_default' }, undefined, 'driver-a'),
      ).rejects.toThrow('Rota de entrega nao encontrada.')

      expect(mockPrisma.deliveryRoute.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ id: 'route-de-b', driverId: 'driver-a' }) }),
      )
      expect(mockPrisma.deliveryRoute.update).not.toHaveBeenCalled()
    })

    it('startRoute: funciona normalmente na propria rota', async () => {
      mockPrisma.deliveryRoute.findFirst.mockResolvedValue({
        id: 'route-a', driverId: 'driver-a', status: 'PLANNED', startsAt: null,
        stops: [{ id: 'stop-1', orderId: 'order-1', status: 'PENDING' }],
      })
      mockPrisma.deliveryRoute.update.mockResolvedValue({})
      mockPrisma.deliveryStop.updateMany.mockResolvedValue({ count: 1 })
      mockPrisma.order.findFirst.mockResolvedValue({ id: 'order-1', status: 'OUT_FOR_DELIVERY' })
      mockPrisma.order.update.mockResolvedValue({})
      mockPrisma.orderEvent.create.mockResolvedValue({})
      mockPrisma.fulfillmentEvent.create.mockResolvedValue({})

      await service.startRoute('route-a', { tenantId: 'tenant_default', storeId: 'store_default' }, undefined, 'driver-a')

      expect(mockPrisma.deliveryRoute.update).toHaveBeenCalled()
    })

    it('completeRoute: 404 quando a rota pertence a outro motorista', async () => {
      mockPrisma.deliveryRoute.findFirst.mockResolvedValue(null)

      await expect(
        service.completeRoute('route-de-b', { tenantId: 'tenant_default', storeId: 'store_default' }, undefined, 'driver-a'),
      ).rejects.toThrow('Rota de entrega nao encontrada.')
    })

    it('gestao administrativa (sem ownerDriverId) continua acessando qualquer rota da loja', async () => {
      mockPrisma.deliveryRoute.findFirst.mockResolvedValue({
        id: 'route-de-qualquer-motorista', driverId: 'outro-driver', status: 'PLANNED', startsAt: null,
        stops: [{ id: 'stop-1', orderId: 'order-1', status: 'PENDING' }],
      })
      mockPrisma.deliveryRoute.update.mockResolvedValue({})
      mockPrisma.deliveryStop.updateMany.mockResolvedValue({ count: 1 })
      mockPrisma.order.findFirst.mockResolvedValue({ id: 'order-1', status: 'OUT_FOR_DELIVERY' })
      mockPrisma.order.update.mockResolvedValue({})
      mockPrisma.orderEvent.create.mockResolvedValue({})
      mockPrisma.fulfillmentEvent.create.mockResolvedValue({})

      // Sem o 4o argumento (ownerDriverId) -- e a chamada que o
      // DeliveryController (admin) faz.
      await service.startRoute('route-de-qualquer-motorista', { tenantId: 'tenant_default', storeId: 'store_default' })

      expect(mockPrisma.deliveryRoute.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.not.objectContaining({ driverId: expect.anything() }) }),
      )
      expect(mockPrisma.deliveryRoute.update).toHaveBeenCalled()
    })
  })
})
