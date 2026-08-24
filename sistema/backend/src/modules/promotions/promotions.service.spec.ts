import { PromotionsService } from './promotions.service'
import { PrismaService } from '../../common/prisma.service'
import { SolidcomERPService } from '../integrations/solidcom-erp.service'

const mockPrismaService = {
  product: {
    findMany: jest.fn(),
    update: jest.fn(),
  },
  promotionCampaign: {
    upsert: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  promotionCampaignItem: {
    upsert: jest.fn(),
  },
}

const mockSolidcomERPService = {
  fetchActivePromotionCampaigns: jest.fn(),
}

describe('PromotionsService', () => {
  let service: PromotionsService

  beforeEach(() => {
    service = new PromotionsService(
      mockPrismaService as unknown as PrismaService,
      mockSolidcomERPService as unknown as SolidcomERPService,
    )
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('syncFromERP', () => {
    it('does nothing when the ERP returns no campaigns', async () => {
      mockSolidcomERPService.fetchActivePromotionCampaigns.mockResolvedValue([])

      const result = await service.syncFromERP()

      expect(result).toEqual({ campaignsSynced: 0, itemsSynced: 0, productsUpdated: 0 })
      expect(mockPrismaService.promotionCampaign.upsert).not.toHaveBeenCalled()
    })

    it('creates the campaign and applies promotionalPrice to matched products', async () => {
      mockSolidcomERPService.fetchActivePromotionCampaigns.mockResolvedValue([
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
      mockSolidcomERPService.fetchActivePromotionCampaigns.mockResolvedValue([
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
})
