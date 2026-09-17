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
    updateMany: jest.fn(),
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

// "Agora" fixo pra toda a suite: 16/09/2026, 22h em Sao Paulo (UTC-3) --
// deliberadamente depois das 21h, o horario em que o bug de fuso do JON-171
// fazia "amanha" (data sem horario) parecer "ja comecou".
const NOW = new Date('2026-09-16T22:00:00-03:00')

describe('PromotionsService', () => {
  let service: PromotionsService

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(NOW)
    service = new PromotionsService(
      mockPrismaService as unknown as PrismaService,
      mockAntenorApiService as unknown as AntenorApiService,
      mockNotificationsService as unknown as NotificationsService,
    )
    mockNotificationsService.getAllCustomerIds.mockResolvedValue(['c1'])
    mockNotificationsService.broadcastToCustomers.mockResolvedValue(undefined)
    mockAntenorApiService.isConfigured.mockReturnValue(true)
    mockPrismaService.promotionCampaignItem.findMany.mockResolvedValue([])
    // activateCampaigns roda dentro de syncFromERP -- default "nada pra
    // ativar" pros testes que nao mexem nisso de proposito.
    mockPrismaService.promotionCampaign.findMany.mockResolvedValue([])
    mockPrismaService.promotionCampaign.updateMany.mockResolvedValue({ count: 1 })
  })

  afterEach(() => {
    jest.useRealTimers()
    jest.clearAllMocks()
  })

  describe('syncFromERP', () => {
    it('does nothing when the ERP returns no campaigns', async () => {
      mockAntenorApiService.getEncartesAtivos.mockResolvedValue([])

      const result = await service.syncFromERP()

      expect(result).toEqual({ campaignsSynced: 0, itemsSynced: 0, productsUpdated: 0 })
      expect(mockPrismaService.promotionCampaign.upsert).not.toHaveBeenCalled()
    })

    it('registers the campaign/item but does NOT touch Product.promotionalPrice by itself (JON-171)', async () => {
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
      // activateCampaigns nao acha nada vigente -- essa campanha ja acabou
      // em agosto, so o cadastro deve ter sido gravado.
      mockPrismaService.promotionCampaign.findMany.mockResolvedValue([])

      const result = await service.syncFromERP()

      expect(mockPrismaService.promotionCampaignItem.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ campaignId: 'campaign-1', productId: 'p1', promotionalPrice: 20 }),
        }),
      )
      expect(mockPrismaService.product.update).not.toHaveBeenCalled()
      expect(result).toEqual({ campaignsSynced: 1, itemsSynced: 1, productsUpdated: 0 })
    })

    it('sync de um encarte JA vigente ativa o preco na mesma chamada (via activateCampaigns)', async () => {
      mockAntenorApiService.getEncartesAtivos.mockResolvedValue([
        {
          erpCampaignId: 376,
          name: 'ENCARTE DE HOJE',
          startDate: '2026-09-16T00:00:00-03:00',
          endDate: '2026-09-18T00:00:00-03:00',
          items: [{ ean: '111', regularPrice: 30, promotionalPrice: 20 }],
        },
      ])
      mockPrismaService.product.findMany.mockResolvedValue([{ id: 'p1', ean: '111' }])
      mockPrismaService.promotionCampaign.upsert.mockResolvedValue({ id: 'campaign-376' })
      mockPrismaService.promotionCampaign.findMany.mockResolvedValue([
        {
          id: 'campaign-376',
          startDate: new Date('2026-09-16T00:00:00-03:00'),
          endDate: new Date('2026-09-18T00:00:00-03:00'),
          items: [{ productId: 'p1', promotionalPrice: 20, product: { id: 'p1', promotionalPrice: null } }],
        },
      ])

      const result = await service.syncFromERP()

      expect(mockPrismaService.product.update).toHaveBeenCalledWith({ where: { id: 'p1' }, data: { promotionalPrice: 20 } })
      expect(result).toEqual({ campaignsSynced: 1, itemsSynced: 1, productsUpdated: 1 })
    })

    it('sync de um encarte de AMANHA (so data, sem horario) nao aplica preco hoje, mesmo as 22h (regressao do JON-171)', async () => {
      mockAntenorApiService.getEncartesAtivos.mockResolvedValue([
        {
          erpCampaignId: 377,
          name: 'ENCARTE DE AMANHA',
          startDate: '2026-09-17', // so a data -- o formato que causava o bug
          endDate: '2026-09-19',
          items: [{ ean: '111', regularPrice: 30, promotionalPrice: 20 }],
        },
      ])
      mockPrismaService.product.findMany.mockResolvedValue([{ id: 'p1', ean: '111' }])
      mockPrismaService.promotionCampaign.upsert.mockImplementation(({ create }: any) => ({
        id: 'campaign-377',
        startDate: create.startDate,
        endDate: create.endDate,
      }))
      // activateCampaigns consulta o banco de novo -- simula a mesma
      // campanha recem-gravada, com as datas resolvidas via parseErpBusinessDate.
      const { parseErpBusinessDate } = require('../../common/business-window')
      mockPrismaService.promotionCampaign.findMany.mockResolvedValue([
        {
          id: 'campaign-377',
          startDate: parseErpBusinessDate('2026-09-17'),
          endDate: parseErpBusinessDate('2026-09-19'),
          items: [{ productId: 'p1', promotionalPrice: 20, product: { id: 'p1', promotionalPrice: null } }],
        },
      ])

      const result = await service.syncFromERP()

      expect(mockPrismaService.product.update).not.toHaveBeenCalled()
      expect(result.productsUpdated).toBe(0)
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

  describe('activateCampaigns', () => {
    it('aplica promotionalPrice em campanha vigente agora', async () => {
      mockPrismaService.promotionCampaign.findMany.mockResolvedValue([
        {
          id: 'campaign-1',
          startDate: new Date('2026-09-16T00:00:00-03:00'),
          endDate: new Date('2026-09-18T00:00:00-03:00'),
          items: [{ productId: 'p1', promotionalPrice: 20, product: { id: 'p1', promotionalPrice: null } }],
        },
      ])

      const result = await service.activateCampaigns()

      expect(mockPrismaService.product.update).toHaveBeenCalledWith({ where: { id: 'p1' }, data: { promotionalPrice: 20 } })
      expect(result).toEqual({ campaignsActivated: 1, productsActivated: 1 })
    })

    it('e idempotente: nao reescreve o produto que ja esta no preco da campanha', async () => {
      mockPrismaService.promotionCampaign.findMany.mockResolvedValue([
        {
          id: 'campaign-1',
          startDate: new Date('2026-09-16T00:00:00-03:00'),
          endDate: new Date('2026-09-18T00:00:00-03:00'),
          items: [{ productId: 'p1', promotionalPrice: 20, product: { id: 'p1', promotionalPrice: 20 } }],
        },
      ])

      const result = await service.activateCampaigns()

      expect(mockPrismaService.product.update).not.toHaveBeenCalled()
      expect(result).toEqual({ campaignsActivated: 1, productsActivated: 0 })
    })

    it('duas campanhas sobrepostas no mesmo produto: a segunda aplicada por ultimo vence, sem erro', async () => {
      mockPrismaService.promotionCampaign.findMany.mockResolvedValue([
        {
          id: 'campaign-a',
          startDate: new Date('2026-09-16T00:00:00-03:00'),
          endDate: new Date('2026-09-18T00:00:00-03:00'),
          items: [{ productId: 'p1', promotionalPrice: 25, product: { id: 'p1', promotionalPrice: null } }],
        },
        {
          id: 'campaign-b',
          startDate: new Date('2026-09-16T00:00:00-03:00'),
          endDate: new Date('2026-09-18T00:00:00-03:00'),
          items: [{ productId: 'p1', promotionalPrice: 20, product: { id: 'p1', promotionalPrice: null } }],
        },
      ])

      const result = await service.activateCampaigns()

      expect(mockPrismaService.product.update).toHaveBeenNthCalledWith(1, { where: { id: 'p1' }, data: { promotionalPrice: 25 } })
      expect(mockPrismaService.product.update).toHaveBeenNthCalledWith(2, { where: { id: 'p1' }, data: { promotionalPrice: 20 } })
      expect(result).toEqual({ campaignsActivated: 2, productsActivated: 2 })
    })

    it('nao ativa quando a consulta devolve uma campanha cujo startDate parseado corretamente ainda esta no futuro', async () => {
      // Defesa em profundidade: mesmo que a query do prisma (feita com o
      // startDate ja gravado) devolva a linha, isWithinBusinessWindow
      // reconfere antes de escrever.
      mockPrismaService.promotionCampaign.findMany.mockResolvedValue([
        {
          id: 'campaign-futura',
          startDate: new Date('2026-09-17T03:00:00.000Z'), // meia-noite BRT de amanha
          endDate: new Date('2026-09-19T03:00:00.000Z'),
          items: [{ productId: 'p1', promotionalPrice: 20, product: { id: 'p1', promotionalPrice: null } }],
        },
      ])

      const result = await service.activateCampaigns()

      expect(mockPrismaService.product.update).not.toHaveBeenCalled()
      expect(result.productsActivated).toBe(0)
    })
  })

  describe('findOneForStorefront', () => {
    it('returns the campaign with items when it exists, is active and is within the business window', async () => {
      mockPrismaService.promotionCampaign.findUnique.mockResolvedValue({
        id: 'campaign-1',
        name: 'SEGUNDA DA CARNE NV',
        slug: 'segunda-da-carne-nv',
        type: 'encarte',
        bannerUrl: null,
        startDate: new Date('2026-09-16T00:00:00-03:00'),
        endDate: new Date('2026-09-18T00:00:00-03:00'),
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

    it('returns null for a campaign that is active=true but still in the future (JON-171)', async () => {
      mockPrismaService.promotionCampaign.findUnique.mockResolvedValue({
        id: 'campaign-futura',
        active: true,
        startDate: new Date('2026-09-17T03:00:00.000Z'),
        endDate: new Date('2026-09-19T03:00:00.000Z'),
        items: [],
      })

      const result = await service.findOneForStorefront(377)

      expect(result).toBeNull()
    })

    it('returns null for a campaign that is active=true but already ended', async () => {
      mockPrismaService.promotionCampaign.findUnique.mockResolvedValue({
        id: 'campaign-vencida',
        active: true,
        startDate: new Date('2026-09-01T00:00:00-03:00'),
        endDate: new Date('2026-09-10T00:00:00-03:00'),
        items: [],
      })

      const result = await service.findOneForStorefront(370)

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
    const campaignInWindow = {
      id: 'campaign-1',
      name: 'SEGUNDA DA CARNE NV',
      startDate: new Date('2026-09-16T00:00:00-03:00'),
      endDate: new Date('2026-09-18T00:00:00-03:00'),
    }

    it('claims atomically, sends the push exactly once and marks startNotifiedAt', async () => {
      mockPrismaService.promotionCampaign.findMany.mockResolvedValueOnce([campaignInWindow]).mockResolvedValueOnce([])
      mockPrismaService.promotionCampaign.updateMany.mockResolvedValueOnce({ count: 1 })

      const result = await service.notifyCampaignLifecycle()

      expect(mockPrismaService.promotionCampaign.updateMany).toHaveBeenCalledWith({
        where: { id: 'campaign-1', startNotifiedAt: null },
        data: { startNotifiedAt: expect.any(Date) },
      })
      expect(mockNotificationsService.broadcastToCustomers).toHaveBeenCalledTimes(1)
      expect(result).toEqual({ started: 1, ending: 0 })
    })

    it('nao dispara o push (nem chama broadcast) quando o claim atomico perde a corrida (count 0)', async () => {
      // Simula duas execucoes concorrentes do scheduler pro mesmo encarte:
      // a primeira ja reivindicou startNotifiedAt entre o findMany e este
      // updateMany.
      mockPrismaService.promotionCampaign.findMany.mockResolvedValueOnce([campaignInWindow]).mockResolvedValueOnce([])
      mockPrismaService.promotionCampaign.updateMany.mockResolvedValueOnce({ count: 0 })

      const result = await service.notifyCampaignLifecycle()

      expect(mockNotificationsService.broadcastToCustomers).not.toHaveBeenCalled()
      expect(result).toEqual({ started: 0, ending: 0 })
    })

    it('nao notifica inicio de campanha cujo startDate parseado ainda esta no futuro (defesa em profundidade)', async () => {
      mockPrismaService.promotionCampaign.findMany
        .mockResolvedValueOnce([
          { id: 'campaign-futura', name: 'AMANHA', startDate: new Date('2026-09-17T03:00:00.000Z'), endDate: new Date('2026-09-19T03:00:00.000Z') },
        ])
        .mockResolvedValueOnce([])

      const result = await service.notifyCampaignLifecycle()

      expect(mockPrismaService.promotionCampaign.updateMany).not.toHaveBeenCalled()
      expect(mockNotificationsService.broadcastToCustomers).not.toHaveBeenCalled()
      expect(result).toEqual({ started: 0, ending: 0 })
    })

    it('does not notify a campaign already marked as notified', async () => {
      mockPrismaService.promotionCampaign.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([])

      const result = await service.notifyCampaignLifecycle()

      expect(mockNotificationsService.broadcastToCustomers).not.toHaveBeenCalled()
      expect(result).toEqual({ started: 0, ending: 0 })
    })

    it('notifies ending for a campaign finishing within 3h, com claim atomico', async () => {
      mockPrismaService.promotionCampaign.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: 'campaign-2', name: 'OFERTA RELAMPAGO' }])
      mockPrismaService.promotionCampaign.updateMany.mockResolvedValueOnce({ count: 1 })

      const result = await service.notifyCampaignLifecycle()

      expect(mockPrismaService.promotionCampaign.updateMany).toHaveBeenCalledWith({
        where: { id: 'campaign-2', endingNotifiedAt: null },
        data: { endingNotifiedAt: expect.any(Date) },
      })
      expect(mockNotificationsService.broadcastToCustomers).toHaveBeenCalledTimes(1)
      expect(result).toEqual({ started: 0, ending: 1 })
    })

    it('nao marca startNotifiedAt (nem qualquer outra escrita) se o push falhar -- so o claim, que ja e intencional', async () => {
      mockPrismaService.promotionCampaign.findMany.mockResolvedValueOnce([campaignInWindow]).mockResolvedValueOnce([])
      mockPrismaService.promotionCampaign.updateMany.mockResolvedValueOnce({ count: 1 })
      mockNotificationsService.broadcastToCustomers.mockRejectedValueOnce(new Error('push provider fora do ar'))

      const result = await service.notifyCampaignLifecycle()

      // O claim ja aconteceu (proposital: prefere perder um aviso a mandar
      // dobrado). O metodo nao deve lancar -- so loga e segue.
      expect(result).toEqual({ started: 0, ending: 0 })
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
