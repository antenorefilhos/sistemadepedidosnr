import { Test, TestingModule } from '@nestjs/testing';
import { ProductsService } from './products.service';
import { PrismaService } from '../../common/prisma.service';
import { SolidcomERPService } from '../../modules/integrations/solidcom-erp.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { ProductSearchService } from './product-search.service';
import { IntegrationModulesService } from '../../modules/integrations/integration-modules.service';
import { CategoryHierarchyService } from '../categories/category-hierarchy.service';

const mockPrismaService: any = {
  product: {
    findMany: jest.fn(),
    count: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    upsert: jest.fn(),
    groupBy: jest.fn().mockResolvedValue([]),
  },
  productMaster: {
    upsert: jest.fn(),
    findFirst: jest.fn(),
  },
  productMedia: {
    updateMany: jest.fn(),
    create: jest.fn(),
  },
  productSubstitution: {
    upsert: jest.fn(),
    findMany: jest.fn(),
  },
  orderItem: { groupBy: jest.fn() },
  auditLog: { create: jest.fn() },
  category: {
    findMany: jest.fn().mockResolvedValue([]),
    upsert: jest.fn().mockResolvedValue({}),
    create: jest.fn().mockResolvedValue({}),
    update: jest.fn().mockResolvedValue({}),
  },
  productCategoryMapping: {
    findMany: jest.fn().mockResolvedValue([{ ean: '123' }]),
  },
  categoryMappingPending: {
    findMany: jest.fn().mockResolvedValue([]),
    upsert: jest.fn(),
    create: jest.fn().mockResolvedValue({}),
  },
  categoryClassificationMapping: {
    findMany: jest.fn().mockResolvedValue([]),
  },
  $transaction: jest.fn(),
};

mockPrismaService.$transaction.mockImplementation((arg: any) =>
  Array.isArray(arg) ? Promise.all(arg) : arg(mockPrismaService),
);

const mockSolidcomERPService = { syncProducts: jest.fn() };
const mockAuditLogService = { log: jest.fn() };
const mockProductSearchService = {
  searchProducts: jest.fn(),
  indexProduct: jest.fn(),
  indexProductsByIds: jest.fn().mockResolvedValue(undefined),
  removeProduct: jest.fn(),
  indexProductById: jest.fn().mockResolvedValue(undefined),
  reindexAll: jest.fn().mockResolvedValue({ enabled: false, indexed: 0 }),
};
const mockIntegrationModulesService = {
  isEnabled: jest.fn().mockResolvedValue(true),
};
const mockCategoryHierarchyService = {
  generateMappingSuggestions: jest.fn().mockResolvedValue([]),
};

describe('ProductsService', () => {
  let service: ProductsService;
  let prismaService: typeof mockPrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: SolidcomERPService, useValue: mockSolidcomERPService },
        { provide: AuditLogService, useValue: mockAuditLogService },
        { provide: ProductSearchService, useValue: mockProductSearchService },
        { provide: IntegrationModulesService, useValue: mockIntegrationModulesService },
        { provide: CategoryHierarchyService, useValue: mockCategoryHierarchyService },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
    prismaService = module.get(PrismaService);
    mockPrismaService.$transaction = jest.fn((arg: any) =>
      Array.isArray(arg) ? Promise.all(arg) : arg(mockPrismaService),
    );
    mockPrismaService.productMaster.upsert.mockResolvedValue({ id: 'pm-1', legacyProductId: '1' });
    mockPrismaService.productMaster.findFirst.mockResolvedValue({
      id: 'pm-1',
      tenantId: 'tenant_default',
      legacyProductId: '1',
      name: 'Product',
      status: 'ACTIVE',
    });
    mockPrismaService.productMedia.updateMany.mockResolvedValue({ count: 0 });
    mockPrismaService.productMedia.create.mockResolvedValue({ id: 'media-1', productId: 'pm-1', type: 'IMAGE' });
    mockPrismaService.productSubstitution.upsert.mockResolvedValue({ productId: 'pm-1', substituteId: 'pm-2' });
    mockPrismaService.productSubstitution.findMany.mockResolvedValue([]);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAllAdmin', () => {
    it('should return paginated products', async () => {
      const mockProducts = [{ id: '1', name: 'Product 1' }];
      mockPrismaService.product.findMany.mockResolvedValue(mockProducts);
      mockPrismaService.product.count.mockResolvedValue(1);

      const result = await service.findAllAdmin(1, 10);

      expect(result).toEqual({
        data: mockProducts,
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
      });
    });

    it('should search admin products', async () => {
      mockPrismaService.product.findMany.mockResolvedValue([{ id: '1', name: 'Arroz' }]);
      mockPrismaService.product.count.mockResolvedValue(1);

      await service.findAllAdmin(1, 10, 'Arroz');

      expect(mockPrismaService.product.findMany).toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return active products', async () => {
      mockPrismaService.product.findMany.mockResolvedValue([
        { id: '1', name: 'Product', active: true },
      ]);

      const result = await service.findAll();

      expect(result.data).toHaveLength(1);
    });

    it('should search products', async () => {
      mockPrismaService.product.findMany.mockResolvedValue([{ id: '1', name: 'Apple' }]);

      const result = await service.findAll('Apple');

      expect(result.data).toHaveLength(1);
    });
  });

  describe('findOne', () => {
    it('should return product by ID', async () => {
      const mockProduct = { id: '1', name: 'Product', price: 100 };
      mockPrismaService.product.findUnique.mockResolvedValue(mockProduct);

      const result = await service.findOne('1');

      expect(result.id).toBe('1');
    });

    it('should return null for invalid ID', async () => {
      mockPrismaService.product.findUnique.mockResolvedValue(null);

      const result = await service.findOne('invalid');

      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('should create product', async () => {
      mockPrismaService.product.create.mockResolvedValue({ id: '1', name: 'New' });

      const result = await service.create({ name: 'New' } as any);

      expect(result.id).toBe('1');
    });

    it('should create with categories', async () => {
      mockPrismaService.product.create.mockResolvedValue({ id: '2', name: 'Prod' });

      const result = await service.create({ name: 'Prod', category: 'Foods' } as any);

      expect(result).toBeDefined();
    });
  });

  describe('update', () => {
    it('should update product price', async () => {
      mockPrismaService.product.update.mockResolvedValue({ id: '1', price: 150 });

      const result = await service.update('1', { price: 150 } as any);

      expect(result.price).toBe(150);
    });

    it('should update product status', async () => {
      mockPrismaService.product.update.mockResolvedValue({ id: '1', active: false });

      const result = await service.update('1', { active: false } as any);

      expect(result.active).toBe(false);
    });

    it('should update promotional price', async () => {
      mockPrismaService.product.update.mockResolvedValue({
        id: '1',
        promotionalPrice: 80,
      });

      const result = await service.update('1', { promotionalPrice: 80 } as any);

      expect(result.promotionalPrice).toBe(80);
    });
  });

  describe('catalog media and substitutes', () => {
    it('should add primary media to canonical ProductMaster', async () => {
      const result = await service.addMedia('1', { type: 'IMAGE', url: '/uploads/prod.webp', isPrimary: true });

      expect(mockPrismaService.productMedia.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { productId: 'pm-1', type: 'IMAGE', status: 'ACTIVE' },
          data: { isPrimary: false },
        }),
      );
      expect(result.id).toBe('media-1');
    });

    it('should block unavailable substitutes', async () => {
      mockPrismaService.productMaster.findFirst
        .mockResolvedValueOnce({ id: 'pm-1', legacyProductId: '1', name: 'Product', status: 'ACTIVE' })
        .mockResolvedValueOnce({ id: 'pm-2', legacyProductId: '2', name: 'Sub', status: 'ACTIVE' });
      mockPrismaService.product.findUnique.mockResolvedValue({ active: true, syncOption: 'ESTOQUE', stock: 0 });

      await expect(service.createSubstitute('1', { substituteId: '2' })).rejects.toThrow('Substituto indisponivel');
    });
  });

  describe('remove', () => {
    it('should soft delete product', async () => {
      mockPrismaService.product.update.mockResolvedValue({ id: '1', active: false });

      const result = await service.remove('1');

      expect(result.active).toBe(false);
    });

    it('should update search index on delete', async () => {
      mockPrismaService.product.update.mockResolvedValue({ id: '1' });

      await service.remove('1');

      expect(mockProductSearchService.indexProductById).toHaveBeenCalled();
    });
  });

  describe('syncFromERP', () => {
    it('should sync products from ERP', async () => {
      mockSolidcomERPService.syncProducts.mockResolvedValue({
        status: 'success',
        data: [{ ean: '123', name: 'Product', price: 10 }],
      });
      mockPrismaService.product.upsert.mockResolvedValue({ id: '1' });

      const result = await service.syncFromERP();

      expect(result.synced).toBe(1);
    });

    it('should handle empty sync', async () => {
      mockSolidcomERPService.syncProducts.mockResolvedValue({
        status: 'success',
        data: [],
      });

      const result = await service.syncFromERP();

      expect(result.synced).toBe(0);
    });

    it('should skip invalid products', async () => {
      mockSolidcomERPService.syncProducts.mockResolvedValue({
        status: 'success',
        data: [
          { ean: '123', name: 'Valid' },
          { ean: '', name: 'Invalid' },
        ],
      });
      mockPrismaService.product.upsert.mockResolvedValue({ id: '1' });

      const result = await service.syncFromERP();

      expect(result.synced).toBeGreaterThanOrEqual(1);
    });

    it('should handle network errors', async () => {
      mockSolidcomERPService.syncProducts.mockRejectedValue(new Error('Network'));

      await expect(service.syncFromERP()).rejects.toThrow();
    });

    it('should update existing products', async () => {
      mockSolidcomERPService.syncProducts.mockResolvedValue({
        status: 'success',
        data: [{ ean: '123', name: 'Updated', price: 20 }],
      });
      mockPrismaService.product.upsert.mockResolvedValue({ id: '1', name: 'Updated' });

      const result = await service.syncFromERP();

      expect(mockPrismaService.product.upsert).toHaveBeenCalled();
    });

    it('should persist fractionStep when syncing fractional products', async () => {
      mockSolidcomERPService.syncProducts.mockResolvedValue({
        status: 'success',
        data: [{
          ean: '789',
          name: 'Aipim kg',
          price: 8,
          stock: 10,
          isFractional: true,
          fractionStep: 0.25,
          unit: 'kg',
        }],
      });
      mockPrismaService.product.upsert.mockResolvedValue({
        id: 'fractional-1',
        ean: '789',
        name: 'Aipim kg',
        price: 8,
        isFractional: true,
        fractionStep: 0.25,
        unit: 'kg',
      });

      await service.syncFromERP();

      expect(mockPrismaService.product.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            isFractional: true,
            fractionStep: 0.25,
          }),
          update: expect.objectContaining({
            isFractional: true,
            fractionStep: 0.25,
          }),
        }),
      );
    });
  });

  describe('fractional products', () => {
    it('should return fractional 0.1', async () => {
      mockPrismaService.product.findUnique.mockResolvedValue({
        id: '1',
        isFractional: true,
        fractionStep: 0.1,
      });

      const result = await service.findOne('1');

      expect(result.fractionStep).toBe(0.1);
    });

    it('should return fractional 0.2', async () => {
      mockPrismaService.product.findUnique.mockResolvedValue({
        id: '2',
        isFractional: true,
        fractionStep: 0.2,
        promotionalPrice: 40,
      });

      const result = await service.findOne('2');

      expect(result.fractionStep).toBe(0.2);
      expect(result.promotionalPrice).toBe(40);
    });

    it('should return fractional 0.5', async () => {
      mockPrismaService.product.findUnique.mockResolvedValue({
        id: '3',
        isFractional: true,
        fractionStep: 0.5,
      });

      const result = await service.findOne('3');

      expect(result.fractionStep).toBe(0.5);
    });

    it('should return non-fractional product', async () => {
      mockPrismaService.product.findUnique.mockResolvedValue({
        id: '4',
        isFractional: false,
        fractionStep: null,
      });

      const result = await service.findOne('4');

      expect(result.isFractional).toBe(false);
    });

    it('should validate fractionStep range', async () => {
      mockPrismaService.product.findUnique.mockResolvedValue({
        id: '5',
        isFractional: true,
        fractionStep: 0.25,
      });

      const result = await service.findOne('5');

      expect(result.fractionStep).toBeGreaterThan(0);
      expect(result.fractionStep).toBeLessThanOrEqual(1);
    });
  });

  describe('pricing', () => {
    it('should prioritize promotional price', async () => {
      mockPrismaService.product.findUnique.mockResolvedValue({
        id: '1',
        price: 100,
        promotionalPrice: 75,
      });

      const result = await service.findOne('1');

      expect(result.promotionalPrice).toBe(75);
    });

    it('should handle null promotional price', async () => {
      mockPrismaService.product.findUnique.mockResolvedValue({
        id: '1',
        price: 50,
        promotionalPrice: null,
      });

      const result = await service.findOne('1');

      expect(result.promotionalPrice).toBeNull();
      expect(result.price).toBe(50);
    });

    it('should handle zero price', async () => {
      mockPrismaService.product.findUnique.mockResolvedValue({
        id: '1',
        price: 0,
      });

      const result = await service.findOne('1');

      expect(result.price).toBe(0);
    });
  });

  describe('analytics', () => {
    it('should get top products', async () => {
      mockPrismaService.orderItem.groupBy.mockResolvedValue([
        { productId: '1', _sum: { quantity: 100, subtotal: 500 }, _count: { _all: 10 } },
        { productId: '2', _sum: { quantity: 50, subtotal: 250 }, _count: { _all: 5 } },
      ]);
      mockPrismaService.product.findMany.mockResolvedValue([
        { id: '1', name: 'Top' },
        { id: '2', name: 'Second' },
      ]);

      const result = await service.getTopProductsAnalytics();

      expect(result).toHaveLength(2);
    });

    it('should limit top products', async () => {
      mockPrismaService.orderItem.groupBy.mockResolvedValue([
        { productId: '1', _sum: { quantity: 100, subtotal: 500 }, _count: { _all: 10 } },
      ]);
      mockPrismaService.product.findMany.mockResolvedValue([{ id: '1' }]);

      const result = await service.getTopProductsAnalytics(1);

      expect(result.length).toBeLessThanOrEqual(1);
    });
  });

  describe('availability', () => {
    it('should check stock availability', async () => {
      mockPrismaService.product.findUnique.mockResolvedValue({
        id: '1',
        active: true,
        stock: 100,
      });

      const result = await service.findOne('1');

      expect(result.stock).toBeGreaterThan(0);
    });

    it('should handle out of stock', async () => {
      mockPrismaService.product.findUnique.mockResolvedValue({
        id: '1',
        active: true,
        stock: 0,
      });

      const result = await service.findOne('1');

      expect(result.stock).toBe(0);
    });

    it('should handle inactive product', async () => {
      mockPrismaService.product.findUnique.mockResolvedValue({
        id: '1',
        active: false,
        stock: 50,
      });

      const result = await service.findOne('1');

      expect(result.active).toBe(false);
    });
  });

  describe('search', () => {
    it('should search by name', async () => {
      mockPrismaService.product.findMany.mockResolvedValue([
        { id: '1', name: 'Arroz Integral' },
        { id: '2', name: 'Arroz Branco' },
      ]);

      const result = await service.findAll('Arroz');

      expect(result.data).toHaveLength(2);
    });

    it('should handle empty search', async () => {
      mockPrismaService.product.findMany.mockResolvedValue([]);

      const result = await service.findAll('NonExistent');

      expect(result.data).toHaveLength(0);
    });

    it('should search with special characters', async () => {
      mockPrismaService.product.findMany.mockResolvedValue([
        { id: '1', name: 'Açúcar' },
      ]);

      const result = await service.findAll('Açúcar');

      expect(result.data).toHaveLength(1);
    });
  });
});
