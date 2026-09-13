import { PromotionsService } from './promotions.service'
import { PrismaService } from '../../common/prisma.service'
import { AntenorApiService } from '../integrations/antenor-api.service'
import { NotificationsService } from '../notifications/notifications.service'

const mockPrismaService = {
  product: {
    findMany: jest.fn(),
    update: jest.fn(),
  },
  promotionCampaign: {
    upsert: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  promotionCampaignItem: {
    upsert: jest.fn(),
    findMany: jest.fn(),
    deleteMany: jest.fn(),
  },
}

const mockAntenorApiService = {
  isConfigured: jest.fn(),
  getEncartesAtivos: jest.fn(),
}

const mockNotificationsService = {
  getAllCustomerIds: jest.fn(),
  broadcastToCustomers: jest.fn(),
}

describe('PromotionsService', () => {
  let service: PromotionsService

  beforeEach(() => {
    service = new PromotionsService(
      mockPrismaService as unknown as PrismaService,
      mockAntenorApiService as unknown as AntenorApiService,
      mockNotificationsService as unknown as NotificationsService,
    )
    mockNotificationsService.getAllCustomerIds.mockResolvedValue(['c1'])
    mockAntenorApiService.isConfigured.mockReturnValue(true)
    mockPrismaService.promotionCampaignItem.findMany.mockResolvedValue([])
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('syncFromERP', () => {
    it('does nothing when the ERP returns no campaigns', async () => {
      mockAntenorApiService.getEncartesAtivos.mockResolvedValue([])

      const result = await service.syncFromERP()

      expect(result).toEqual({ campaignsSynced: 0, itemsSynced: 0, productsUpdated: 0 })
      expect(mockPrismaService.promotionCampaign.upsert).not.toHaveBeenCalled()
    })

    it('creates the campaign and applies promotionalPrice to matched products', async () => {
      mockAntenorApiService.getEncartesAtivos.mockResolvedValue([
        {
          erpCampaignId: 375,
          name: 'SEGUNDA DA CARNE NV',
          startDate: '2026-08-24T00:00:00.000Z',
          endDate: '2026-08-25T00:00:00.000Z',
          items: [{ ean: '111', regularPrice: 30, promotionalPrice: 20 }],
        },
      ])
      mockPrismaService.product.findMany.mockResolvedValue([{ id: 'p1', ean: '111' }])
      mockPrismaService.promotionCampaign.upsert.mockResolvedValue({ id: 'campaign-1' })

      const result = await service.syncFromERP()

      expect(mockPrismaService.promotionCampaignItem.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ campaignId: 'campaign-1', productId: 'p1', promotionalPrice: 20 }),
        }),
      )
      expect(mockPrismaService.product.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { promotionalPrice: 20 },
      })
      expect(result).toEqual({ campaignsSynced: 1, itemsSynced: 1, productsUpdated: 1 })
    })

    it('skips campaign items without a matching product in the catalog', async () => {
      mockAntenorApiService.getEncartesAtivos.mockResolvedValue([
        {
          erpCampaignId: 375,
          name: 'SEGUNDA DA CARNE NV',
          startDate: '2026-08-24T00:00:00.000Z',
          endDate: '2026-08-25T00:00:00.000Z',
          items: [{ ean: 'unknown-ean', regularPrice: 30, promotionalPrice: 20 }],
        },
      ])
      mockPrismaService.product.findMany.mockResolvedValue([])
      mockPrismaService.promotionCampaign.upsert.mockResolvedValue({ id: 'campaign-1' })

      const result = await service.syncFromERP()

      expect(mockPrismaService.promotionCampaignItem.upsert).not.toHaveBeenCalled()
      expect(mockPrismaService.product.update).not.toHaveBeenCalled()
      expect(result.productsUpdated).toBe(0)
    })

    it('prunes campaign items that no longer come back from the ERP (ex: bug de join corrigido na origem, AEF-033)', async () => {
      mockAntenorApiService.getEncartesAtivos.mockResolvedValue([
        {
          erpCampaignId: 372,
          name: 'ENCARTE FINAL SEMANA NR',
          startDate: '2026-09-12T00:00:00.000Z',
          endDate: '2026-09-13T00:00:00.000Z',
          items: [{ ean: '111', regularPrice: 30, promotionalPrice: 20 }],
        },
      ])
      mockPrismaService.product.findMany.mockResolvedValue([{ id: 'p-certo', ean: '111' }])
      mockPrismaService.promotionCampaign.upsert.mockResolvedValue({ id: 'campaign-372' })
      // Item orfao de uma sincronizacao anterior (o produto errado que o join
      // quebrado da v1.10.0 tinha trazido) -- nao vem mais no retorno do ERP.
      mockPrismaService.promotionCampaignItem.findMany.mockResolvedValue([
        { id: 'item-orfao', productId: 'p-errado', promotionalPrice: 8.99, product: { id: 'p-errado', promotionalPrice: 8.99 } },
      ])

      await service.syncFromERP()

      expect(mockPrismaService.product.update).toHaveBeenCalledWith({ where: { id: 'p-errado' }, data: { promotionalPrice: null } })
      expect(mockPrismaService.promotionCampaignItem.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ['item-orfao'] } } })
    })

    it('does not touch the product price when it no longer matches the stale campaign item (outra promocao aplicou por cima)', async () => {
      mockAntenorApiService.getEncartesAtivos.mockResolvedValue([
        {
          erpCampaignId: 372,
          name: 'ENCARTE FINAL SEMANA NR',
          startDate: '2026-09-12T00:00:00.000Z',
          endDate: '2026-09-13T00:00:00.000Z',
          items: [],
        },
      ])
      mockPrismaService.product.findMany.mockResolvedValue([])
      mockPrismaService.promotionCampaign.upsert.mockResolvedValue({ id: 'campaign-372' })
      mockPrismaService.promotionCampaignItem.findMany.mockResolvedValue([
        { id: 'item-orfao', productId: 'p-outro', promotionalPrice: 8.99, product: { id: 'p-outro', promotionalPrice: 5.0 } },
      ])

      await service.syncFromERP()

      expect(mockPrismaService.product.update).not.toHaveBeenCalled()
      expect(mockPrismaService.promotionCampaignItem.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ['item-orfao'] } } })
    })

    it('does nothing when the AntenorApi connector is not configured', async () => {
      mockAntenorApiService.isConfigured.mockReturnValue(false)

      const result = await service.syncFromERP()

      expect(result).toEqual({ campaignsSynced: 0, itemsSynced: 0, productsUpdated: 0 })
      expect(mockAntenorApiService.getEncartesAtivos).not.toHaveBeenCalled()
    })
  })

  describe('findOneForStorefront', () => {
    it('returns the campaign with items when it exists and is active', async () => {
      mockPrismaService.promotionCampaign.findUnique.mockResolvedValue({
        id: 'campaign-1',
        name: 'SEGUNDA DA CARNE NV',
        slug: 'segunda-da-carne-nv',
        type: 'encarte',
        bannerUrl: null,
        startDate: new Date(),
        endDate: new Date(),
        highlightInHome: false,
        active: true,
        items: [{ product: { id: 'p1', name: 'Picanha' }, regularPrice: 50, promotionalPrice: 40, discountPercent: 20 }],
      })

      const result = await service.findOneForStorefront(375)

      expect(result?.items).toEqual([expect.objectContaining({ id: 'p1', promotionalPrice: 40 })])
    })

    it('returns null when the campaign does not exist or is inactive', async () => {
      mockPrismaService.promotionCampaign.findUnique.mockResolvedValue(null)

      const result = await service.findOneForStorefront(999)

      expect(result).toBeNull()
    })

    it('returns null for a non-numeric erpCampaignId without querying the database', async () => {
      const result = await service.findOneForStorefront(NaN)

      expect(result).toBeNull()
      expect(mockPrismaService.promotionCampaign.findUnique).not.toHaveBeenCalled()
    })
  })

  describe('expireCampaigns', () => {
    it('clears promotionalPrice only when it still matches the campaign price', async () => {
      mockPrismaService.promotionCampaign.findMany.mockResolvedValue([
        {
          id: 'campaign-1',
          items: [
            { productId: 'p1', promotionalPrice: 20, product: { id: 'p1', promotionalPrice: 20 } },
            // Preco atual diverge do preco da campanha (outra promocao aplicou por cima) -- nao mexe
            { productId: 'p2', promotionalPrice: 15, product: { id: 'p2', promotionalPrice: 12 } },
          ],
        },
      ])

      const result = await service.expireCampaigns()

      expect(mockPrismaService.product.update).toHaveBeenCalledTimes(1)
      expect(mockPrismaService.product.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { promotionalPrice: null },
      })
      expect(mockPrismaService.promotionCampaign.update).toHaveBeenCalledWith({
        where: { id: 'campaign-1' },
        data: { active: false },
      })
      expect(result).toEqual({ campaignsExpired: 1, productsCleared: 1 })
    })

    it('does nothing when there are no expired campaigns', async () => {
      mockPrismaService.promotionCampaign.findMany.mockResolvedValue([])

      const result = await service.expireCampaigns()

      expect(result).toEqual({ campaignsExpired: 0, productsCleared: 0 })
      expect(mockPrismaService.product.update).not.toHaveBeenCalled()
    })
  })

  describe('notifyCampaignLifecycle', () => {
    it('notifies start and marks startNotifiedAt for a campaign that just began', async () => {
      mockPrismaService.promotionCampaign.findMany
        .mockResolvedValueOnce([{ id: 'campaign-1', name: 'SEGUNDA DA CARNE NV' }])
        .mockResolvedValueOnce([])

      const result = await service.notifyCampaignLifecycle()

      expect(mockNotificationsService.broadcastToCustomers).toHaveBeenCalledTimes(1)
      expect(mockPrismaService.promotionCampaign.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'campaign-1' }, data: { startNotifiedAt: expect.any(Date) } }),
      )
      expect(result).toEqual({ started: 1, ending: 0 })
    })

    it('does not notify a campaign already marked as notified', async () => {
      mockPrismaService.promotionCampaign.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([])

      const result = await service.notifyCampaignLifecycle()

      expect(mockNotificationsService.broadcastToCustomers).not.toHaveBeenCalled()
      expect(result).toEqual({ started: 0, ending: 0 })
    })

    it('notifies ending for a campaign finishing within 3h', async () => {
      mockPrismaService.promotionCampaign.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: 'campaign-2', name: 'OFERTA RELAMPAGO' }])

      const result = await service.notifyCampaignLifecycle()

      expect(mockNotificationsService.broadcastToCustomers).toHaveBeenCalledTimes(1)
      expect(mockPrismaService.promotionCampaign.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'campaign-2' }, data: { endingNotifiedAt: expect.any(Date) } }),
      )
      expect(result).toEqual({ started: 0, ending: 1 })
    })

    it('does nothing outside the start/ending windows', async () => {
      mockPrismaService.promotionCampaign.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([])

      const result = await service.notifyCampaignLifecycle()

      expect(mockNotificationsService.broadcastToCustomers).not.toHaveBeenCalled()
      expect(mockPrismaService.promotionCampaign.update).not.toHaveBeenCalled()
      expect(result).toEqual({ started: 0, ending: 0 })
    })
  })
})
