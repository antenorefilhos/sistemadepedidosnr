import { PromotionsService } from './promotions.service'
import { PrismaService } from '../../common/prisma.service'
import { AntenorApiService } from '../integrations/antenor-api.service'

const mockPrismaService = {
  brandConfig: { findUnique: jest.fn() },
  autoOfferSettings: { upsert: jest.fn() },
  scheduledNotification: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
  encarteNameRule: { findMany: jest.fn().mockResolvedValue([]) },
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

// "Agora" fixo pra toda a suite: 16/09/2026, 22h em Sao Paulo (UTC-3) --
// deliberadamente depois das 21h, o horario em que o bug de fuso do JON-171
// fazia "amanha" (data sem horario) parecer "ja comecou".
const NOW = new Date('2026-09-16T22:00:00-03:00')

// Horario da loja (02/10/2026): segunda a sabado 07:00-20:50, domingo 07:00-13:45.
// 16/09/2026 e uma quarta: as 22h a loja ja fechou e o pedido e de quinta (17/09).
const LOJA = {
  businessHours: JSON.stringify(
    Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((d) => [d, { enabled: true, windows: [{ start: '07:00', end: d === 0 ? '13:45' : '20:50' }] }])),
  ),
  specialDates: '[]',
}
const comLoja = () => mockPrismaService.brandConfig.findUnique.mockResolvedValue(LOJA)

describe('PromotionsService', () => {
  let service: PromotionsService

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(NOW)
    service = new PromotionsService(
      mockPrismaService as unknown as PrismaService,
      mockAntenorApiService as unknown as AntenorApiService,
    )
    mockAntenorApiService.isConfigured.mockReturnValue(true)
    mockPrismaService.promotionCampaignItem.findMany.mockResolvedValue([])
    // activateCampaigns roda dentro de syncFromERP -- default "nada pra
    // ativar" pros testes que nao mexem nisso de proposito.
    mockPrismaService.promotionCampaign.findMany.mockResolvedValue([])
    mockPrismaService.promotionCampaign.updateMany.mockResolvedValue({ count: 1 })
    // Sem horario configurado = dia de calendario (comportamento sem a tela de horario).
    mockPrismaService.brandConfig.findUnique.mockResolvedValue(null)
    mockPrismaService.product.findMany.mockResolvedValue([])
    mockPrismaService.autoOfferSettings.upsert.mockResolvedValue({ encarteEnabled: true, encarteApproval: false })
    mockPrismaService.scheduledNotification.findUnique.mockResolvedValue(null)
    mockPrismaService.scheduledNotification.updateMany.mockResolvedValue({ count: 0 })
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

    it('JON-184: persiste os campos enriquecidos do encarte (destaque, atacado, preco de clube)', async () => {
      mockAntenorApiService.getEncartesAtivos.mockResolvedValue([
        {
          erpCampaignId: 375,
          name: 'SEGUNDA DA CARNE NV',
          startDate: '2026-08-24T00:00:00.000Z',
          endDate: '2026-08-25T00:00:00.000Z',
          items: [{
            ean: '111', regularPrice: 30, promotionalPrice: 20,
            highlightCover: true, strongSuggestion: true,
            wholesaleMinQty: 3, wholesalePrice: 18, clubPrice: 17.5,
          }],
        },
      ])
      mockPrismaService.product.findMany.mockResolvedValue([{ id: 'p1', ean: '111' }])
      mockPrismaService.promotionCampaign.upsert.mockResolvedValue({ id: 'campaign-1' })
      mockPrismaService.promotionCampaign.findMany.mockResolvedValue([])

      await service.syncFromERP()

      expect(mockPrismaService.promotionCampaignItem.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            highlightCover: true,
            strongSuggestion: true,
            wholesaleMinQty: 3,
            wholesalePrice: 18,
            clubPrice: 17.5,
          }),
        }),
      )
    })

    it('JON-184: campos enriquecidos ausentes gravam default seguro (false/null), nao quebram', async () => {
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
      mockPrismaService.promotionCampaign.findMany.mockResolvedValue([])

      await service.syncFromERP()

      expect(mockPrismaService.promotionCampaignItem.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            highlightCover: false,
            strongSuggestion: false,
            wholesaleMinQty: null,
            wholesalePrice: null,
            clubPrice: null,
          }),
        }),
      )
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

      expect(mockPrismaService.product.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { promotionalPrice: 20, promotionalPriceValidUntil: new Date('2026-09-18T00:00:00-03:00') },
      })
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

      expect(mockPrismaService.product.update).toHaveBeenCalledWith({ where: { id: 'p-errado' }, data: { promotionalPrice: null, promotionalPriceValidUntil: null } })
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

      expect(mockPrismaService.product.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { promotionalPrice: 20, promotionalPriceValidUntil: new Date('2026-09-18T00:00:00-03:00') },
      })
      expect(result).toEqual({ campaignsActivated: 1, productsActivated: 1 })
    })

    it('e idempotente: nao reescreve o produto que ja esta no preco da campanha', async () => {
      mockPrismaService.promotionCampaign.findMany.mockResolvedValue([
        {
          id: 'campaign-1',
          startDate: new Date('2026-09-16T00:00:00-03:00'),
          endDate: new Date('2026-09-18T00:00:00-03:00'),
          items: [{ productId: 'p1', promotionalPrice: 20, product: { id: 'p1', promotionalPrice: 20, promotionalPriceValidUntil: new Date('2026-09-18T00:00:00-03:00') } }],
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

      const fim = new Date('2026-09-18T00:00:00-03:00')
      expect(mockPrismaService.product.update).toHaveBeenNthCalledWith(1, { where: { id: 'p1' }, data: { promotionalPrice: 25, promotionalPriceValidUntil: fim } })
      expect(mockPrismaService.product.update).toHaveBeenNthCalledWith(2, { where: { id: 'p1' }, data: { promotionalPrice: 20, promotionalPriceValidUntil: fim } })
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

  describe('horario da loja (02/10/2026): o preco segue o dia da entrega', () => {
    const { parseErpBusinessDate, parseErpBusinessDateEnd } = require('../../common/business-window')

    it('com a loja fechada na vespera, o encarte de amanha ja vale no site (opcao A)', async () => {
      comLoja()
      mockPrismaService.promotionCampaign.findMany.mockResolvedValue([
        {
          id: 'amanha',
          startDate: parseErpBusinessDate('2026-09-17'),
          endDate: parseErpBusinessDateEnd('2026-09-17'),
          items: [{ productId: 'p1', promotionalPrice: 20, product: { id: 'p1', promotionalPrice: null } }],
        },
      ])

      const result = await service.activateCampaigns()

      expect(result.productsActivated).toBe(1)
    })

    it('com a loja ainda aberta, o encarte de amanha nao vale', async () => {
      comLoja()
      jest.setSystemTime(new Date('2026-09-16T20:30:00-03:00'))
      mockPrismaService.promotionCampaign.findMany.mockResolvedValue([
        {
          id: 'amanha',
          startDate: parseErpBusinessDate('2026-09-17'),
          endDate: parseErpBusinessDateEnd('2026-09-17'),
          items: [{ productId: 'p1', promotionalPrice: 20, product: { id: 'p1', promotionalPrice: null } }],
        },
      ])

      expect((await service.activateCampaigns()).productsActivated).toBe(0)
    })

    it('no ultimo dia, depois do fechamento, o encarte sai do site (nao espera a meia-noite)', async () => {
      comLoja()
      mockPrismaService.promotionCampaign.findMany.mockResolvedValue([
        {
          id: 'acaba-hoje',
          startDate: parseErpBusinessDate('2026-09-14'),
          endDate: parseErpBusinessDateEnd('2026-09-16'),
          items: [{ productId: 'p1', promotionalPrice: 20, product: { id: 'p1', promotionalPrice: 20 } }],
        },
      ])

      const result = await service.expireCampaigns()

      expect(mockPrismaService.product.update).toHaveBeenCalledWith({ where: { id: 'p1' }, data: { promotionalPrice: null, promotionalPriceValidUntil: null } })
      expect(result).toEqual({ campaignsExpired: 1, productsCleared: 1 })
    })

    it('no ultimo dia, com a loja aberta, o encarte continua', async () => {
      comLoja()
      jest.setSystemTime(new Date('2026-09-16T20:40:00-03:00'))
      mockPrismaService.promotionCampaign.findMany.mockResolvedValue([
        {
          id: 'acaba-hoje',
          startDate: parseErpBusinessDate('2026-09-14'),
          endDate: parseErpBusinessDateEnd('2026-09-16'),
          items: [{ productId: 'p1', promotionalPrice: 20, product: { id: 'p1', promotionalPrice: 20 } }],
        },
      ])

      expect(await service.expireCampaigns()).toEqual({ campaignsExpired: 0, productsCleared: 0 })
    })

    it('oferta do ERP por produto que acaba hoje tambem sai no fechamento', async () => {
      comLoja()
      mockPrismaService.product.findMany.mockResolvedValue([
        { id: 'p-hoje', promotionalPriceValidUntil: parseErpBusinessDateEnd('2026-09-16') },
        { id: 'p-amanha', promotionalPriceValidUntil: parseErpBusinessDateEnd('2026-09-17') },
      ])

      const result = await service.expireCampaigns()

      expect(mockPrismaService.product.update).toHaveBeenCalledTimes(1)
      expect(mockPrismaService.product.update).toHaveBeenCalledWith({ where: { id: 'p-hoje' }, data: { promotionalPrice: null, promotionalPriceValidUntil: null } })
      expect(result.productsCleared).toBe(1)
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
          endDate: new Date('2026-09-15T23:59:59.999-03:00'),
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
        data: { promotionalPrice: null, promotionalPriceValidUntil: null },
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

  describe('fila de envios: planCampaignNotifications (02/10/2026)', () => {
    const { parseErpBusinessDate, parseErpBusinessDateEnd } = require('../../common/business-window')
    const { encarteSchedule } = require('./promotions.service')
    const { parseHoursConfig } = require('../../common/delivery-hours')
    const hours = parseHoursConfig(LOJA.businessHours, LOJA.specialDates)
    const sp = (d: Date) => d.toLocaleString('sv-SE', { timeZone: 'America/Sao_Paulo' }).slice(0, 16)
    const encarte = (over: Record<string, unknown> = {}) => ({
      id: 'c1',
      tenantId: 'tenant_default',
      erpCampaignId: 370,
      name: 'VALIDADE NR',
      customerName: 'Ofertas Relâmpago',
      nearExpiry: true,
      active: true,
      startDate: parseErpBusinessDate('2026-09-17'),
      endDate: parseErpBusinessDateEnd('2026-09-17'),
      startNotifiedAt: null,
      endingNotifiedAt: null,
      items: [
        { promotionalPrice: 5.99, regularPrice: 7.99, discountPercent: 25, product: { name: 'Leite Elege 1L', titleMask: null, active: true, syncOption: 'SEMPRE', stock: 1, isFractional: false } },
        { promotionalPrice: 5.99, regularPrice: 8.99, discountPercent: 33, product: { name: 'Batata Palha Yoki', titleMask: null, active: false, syncOption: 'SEMPRE', stock: 1, isFractional: false } },
        { promotionalPrice: 7.99, regularPrice: 7.99, discountPercent: 0, product: { name: 'Bebida Lactea', titleMask: null, active: true, syncOption: 'SEMPRE', stock: 1, isFractional: false } },
      ],
      ...over,
    })

    it('encarteSchedule: abertura do primeiro dia, 3h antes do fechamento e limite no fechamento', () => {
      const plan = encarteSchedule(hours, parseErpBusinessDate('2026-09-17'), parseErpBusinessDateEnd('2026-09-17'), new Date('2026-09-16T22:00:00-03:00'))
      expect(sp(plan.startAt)).toBe('2026-09-17 07:00')
      expect(sp(plan.endAt)).toBe('2026-09-17 17:50')
      expect(sp(plan.expiresAt)).toBe('2026-09-17 20:50')
    })

    it('encarteSchedule: encarte que termina no domingo usa o fechamento das 13h45', () => {
      const plan = encarteSchedule(hours, parseErpBusinessDate('2026-09-19'), parseErpBusinessDateEnd('2026-09-20'), new Date('2026-09-19T08:00:00-03:00'))
      expect(sp(plan.startAt)).toBe('2026-09-19 08:00')
      expect(sp(plan.endAt)).toBe('2026-09-20 10:45')
      expect(sp(plan.expiresAt)).toBe('2026-09-20 13:45')
    })

    it('encarteSchedule: depois do fechamento do ultimo dia nao ha mais aviso', () => {
      expect(encarteSchedule(hours, parseErpBusinessDate('2026-09-17'), parseErpBusinessDateEnd('2026-09-17'), new Date('2026-09-17T20:50:00-03:00'))).toBeNull()
    })

    it('planeja inicio e fim na fila com o nome do cliente, a melhor oferta real e o destino do encarte', async () => {
      comLoja()
      mockPrismaService.promotionCampaign.findMany.mockResolvedValue([encarte()])

      const result = await service.planCampaignNotifications()

      expect(result.planned).toBe(2)
      const created = mockPrismaService.scheduledNotification.create.mock.calls.map((c: any) => c[0].data)
      expect(created.map((d: any) => d.sourceKey)).toEqual(['encarte:c1:inicio', 'encarte:c1:fim'])
      expect(created[0]).toEqual(expect.objectContaining({ origin: 'ENCARTE_INICIO', status: 'SCHEDULED', title: '🛍️ Já está no ar: Ofertas Relâmpago', url: '/encarte/370', respectHours: true }))
      // So o leite e oferta de verdade: batata inativa, bebida lactea sem desconto.
      expect(created[0].body).toBe('Leite Elege 1L de R$ 7,99 por R$ 5,99.')
      expect(created[1]).toEqual(expect.objectContaining({ origin: 'ENCARTE_FIM', title: '⏰ Últimas horas: Ofertas Relâmpago' }))
      expect(created[1].body).toBe('Termina hoje às 20:50. Leite Elege 1L de R$ 7,99 por R$ 5,99.')
      expect(sp(created[1].sendAt)).toBe('2026-09-17 17:50')
      expect(created[0].meta).toEqual(expect.objectContaining({ offers: 1, items: 3 }))
    })

    it('com aprovacao exigida, entra como aguardando aprovacao', async () => {
      comLoja()
      mockPrismaService.autoOfferSettings.upsert.mockResolvedValue({ encarteEnabled: true, encarteApproval: true })
      mockPrismaService.promotionCampaign.findMany.mockResolvedValue([encarte()])

      await service.planCampaignNotifications()

      expect(mockPrismaService.scheduledNotification.create.mock.calls[0][0].data.status).toBe('PENDING_APPROVAL')
    })

    it('inicio ja enviado (legado): planeja so o fim', async () => {
      comLoja()
      mockPrismaService.promotionCampaign.findMany.mockResolvedValue([encarte({ startNotifiedAt: new Date() })])

      await service.planCampaignNotifications()

      expect(mockPrismaService.scheduledNotification.create).toHaveBeenCalledTimes(1)
      expect(mockPrismaService.scheduledNotification.create.mock.calls[0][0].data.sourceKey).toBe('encarte:c1:fim')
    })

    it('nao pisa no que o admin editou: so atualiza limite e contexto', async () => {
      comLoja()
      mockPrismaService.promotionCampaign.findMany.mockResolvedValue([encarte()])
      mockPrismaService.scheduledNotification.findUnique.mockResolvedValue({ id: 'q1', status: 'SCHEDULED', editedAt: new Date(), title: 'Meu título' })

      await service.planCampaignNotifications()

      const data = mockPrismaService.scheduledNotification.update.mock.calls[0][0].data
      expect(Object.keys(data).sort()).toEqual(['expiresAt', 'meta'])
    })

    it('o que ja saiu ou foi cancelado pelo admin nao volta', async () => {
      comLoja()
      mockPrismaService.promotionCampaign.findMany.mockResolvedValue([encarte()])
      mockPrismaService.scheduledNotification.findUnique.mockResolvedValue({ id: 'q1', status: 'CANCELLED', note: 'Cancelado no admin.' })

      const result = await service.planCampaignNotifications()

      expect(mockPrismaService.scheduledNotification.create).not.toHaveBeenCalled()
      expect(mockPrismaService.scheduledNotification.update).not.toHaveBeenCalled()
      expect(result.planned).toBe(0)
    })

    it('avisos de encarte desligados: cancela o que ainda nao saiu, com o motivo', async () => {
      comLoja()
      mockPrismaService.autoOfferSettings.upsert.mockResolvedValue({ encarteEnabled: false, encarteApproval: false })
      mockPrismaService.promotionCampaign.findMany.mockResolvedValue([encarte()])
      mockPrismaService.scheduledNotification.updateMany.mockResolvedValue({ count: 2 })

      const result = await service.planCampaignNotifications()

      expect(mockPrismaService.scheduledNotification.updateMany).toHaveBeenCalledWith({
        where: { sourceKey: { in: ['encarte:c1:inicio', 'encarte:c1:fim'] }, status: { in: ['SCHEDULED', 'PENDING_APPROVAL'] } },
        data: expect.objectContaining({ status: 'CANCELLED', note: 'Avisos de encarte desligados na fila.' }),
      })
      expect(result.cancelled).toBe(2)
    })

    it('religou: o que o sistema cancelou por "desligado" volta para a fila', async () => {
      comLoja()
      mockPrismaService.promotionCampaign.findMany.mockResolvedValue([encarte()])
      mockPrismaService.scheduledNotification.findUnique.mockResolvedValue({ id: 'q1', status: 'CANCELLED', note: 'Avisos de encarte desligados na fila.' })

      const result = await service.planCampaignNotifications()

      expect(mockPrismaService.scheduledNotification.update.mock.calls[0][0].data).toEqual(expect.objectContaining({ status: 'SCHEDULED', note: null }))
      expect(result.planned).toBe(2)
    })
  })
})
