import { CatalogService } from './catalog.service'
import { PrismaService } from '../../common/prisma.service'
import { ProductSearchService } from '../products/product-search.service'

const mockPrisma: any = {
  productMaster: {
    findMany: jest.fn(),
    count: jest.fn(),
  },
  product: {
    findMany: jest.fn(),
  },
  catalogQualityIssue: {
    deleteMany: jest.fn(),
    createMany: jest.fn(),
    count: jest.fn(),
    groupBy: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  category: {
    findMany: jest.fn(),
  },
  categoryNode: {
    upsert: jest.fn(),
    findUnique: jest.fn(),
  },
}

const mockProductSearch = {
  reindexAll: jest.fn(),
}

describe('CatalogService', () => {
  let service: CatalogService

  beforeEach(() => {
    jest.clearAllMocks()
    service = new CatalogService(mockPrisma as PrismaService, mockProductSearch as unknown as ProductSearchService)
  })

  it('generates prioritized quality issues for catalog defects', async () => {
    mockPrisma.productMaster.findMany.mockResolvedValue([
      {
        id: 'pm-1',
        tenantId: 'tenant-a',
        legacyProductId: 'prod-1',
        ean: '789',
        name: 'Produto',
        isWeighted: true,
        minWeight: null,
        weightStep: null,
        legacyCategory: 'GERAL',
        media: [],
        categoryAssignments: [],
      },
    ])
    mockPrisma.product.findMany.mockResolvedValue([
      {
        id: 'prod-1',
        storeId: 'store-a',
        price: 0,
        promotionalPrice: null,
        stock: -1,
        active: true,
        syncOption: 'ESTOQUE',
        category: 'GERAL',
        classification01: '08-FLV',
      },
    ])
    mockPrisma.catalogQualityIssue.deleteMany.mockResolvedValue({ count: 0 })
    mockPrisma.catalogQualityIssue.createMany.mockResolvedValue({ count: 7 })

    const result = await service.refreshQualityIssues({ tenantId: 'tenant-a', storeId: 'store-a' })

    expect(result.generated).toBeGreaterThanOrEqual(6)
    const created = mockPrisma.catalogQualityIssue.createMany.mock.calls[0][0].data
    expect(created.map((issue: any) => issue.type)).toEqual(expect.arrayContaining([
      'MISSING_IMAGE',
      'MISSING_CATEGORY',
      'WEIGHT_RULE_MISSING',
      'ZERO_PRICE',
      'NEGATIVE_STOCK',
      'INCOMPATIBLE_CATEGORY',
    ]))
  })

  it('rebuilds canonical category nodes from CMS hierarchy', async () => {
    mockPrisma.category.findMany.mockResolvedValue([
      { id: 'cat-root', tenantId: 'tenant-a', parentId: null, name: 'Hortifruti', active: true, priority: 1 },
      { id: 'cat-child', tenantId: 'tenant-a', parentId: 'cat-root', name: 'Frutas', active: true, priority: 2 },
    ])
    mockPrisma.categoryNode.upsert
      .mockResolvedValueOnce({ id: 'cn_cat-root', level: 1 })
      .mockResolvedValueOnce({ id: 'cn_cat-child', level: 2 })
    mockPrisma.categoryNode.findUnique.mockResolvedValue({ id: 'cn_cat-root', level: 1 })

    const result = await service.rebuildCategoryTree({ tenantId: 'tenant-a' })

    expect(result.nodesUpserted).toBe(2)
    expect(mockPrisma.categoryNode.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ legacyCategoryId: 'cat-child', parentId: 'cn_cat-root', level: 2 }),
      }),
    )
  })
})
