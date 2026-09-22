import { Test, TestingModule } from '@nestjs/testing';
import { ProductsService } from './products.service';
import { PrismaService } from '../../common/prisma.service';
import { SolidcomERPService } from '../../modules/integrations/solidcom-erp.service';
import { AntenorApiService } from '../../modules/integrations/antenor-api.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { ProductSearchService } from './product-search.service';
import { IntegrationModulesService } from '../../modules/integrations/integration-modules.service';
import { CategoryHierarchyService } from '../categories/category-hierarchy.service';

const mockPrismaService: any = {
  product: {
    findMany: jest.fn().mockResolvedValue([]),
    count: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn().mockResolvedValue({ count: 0 }),
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
  // Busca por texto usa SQL cru (products.service: searchByRawQuery), nao
  // product.findMany -- mockar o findMany aqui nao afeta o resultado.
  $queryRaw: jest.fn(),
};

mockPrismaService.$transaction.mockImplementation((arg: any) =>
  Array.isArray(arg) ? Promise.all(arg) : arg(mockPrismaService),
);

/** A busca por texto faz dois $queryRaw: as linhas e depois o COUNT. */
const mockSearchRows = (rows: any[]) => {
  mockPrismaService.$queryRaw
    .mockResolvedValueOnce(rows)
    .mockResolvedValueOnce([{ total: BigInt(rows.length) }]);
};

const mockSolidcomERPService = {
  syncProducts: jest.fn(),
  fetchByEan: jest.fn().mockResolvedValue(null),
  fetchRecentChanges: jest.fn().mockResolvedValue([]),
};
const mockAntenorApiService = {
  syncProducts: jest.fn(),
  fetchRecentChanges: jest.fn().mockResolvedValue([]),
};
const mockAuditLogService = { log: jest.fn() };
const mockProductSearchService = {
  searchProducts: jest.fn(),
  indexProduct: jest.fn(),
  indexProductsByIds: jest.fn().mockResolvedValue(undefined),
  removeProduct: jest.fn(),
  indexProductById: jest.fn().mockResolvedValue(undefined),
  reindexAll: jest.fn().mockResolvedValue({ enabled: false, indexed: 0 }),
  isEnabled: jest.fn().mockReturnValue(false),
  suggest: jest.fn().mockResolvedValue([]),
};
// Espelha o default real (integration-modules.service.ts): solidcom ligado,
// antenorapi desligado -- senao todo teste que espera o caminho Solidcom
// passaria a rotear por AntenorApi (que tem prioridade em resolveCatalogSource)
// sem nenhum teste ter mudado nada.
const mockIntegrationModulesService = {
  isEnabled: jest.fn((key: string) => Promise.resolve(key === 'solidcom')),
};
const mockCategoryHierarchyService = {
  generateMappingSuggestions: jest.fn().mockResolvedValue([]),
};

describe('ProductsService', () => {
  let service: ProductsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: SolidcomERPService, useValue: mockSolidcomERPService },
        { provide: AntenorApiService, useValue: mockAntenorApiService },
        { provide: AuditLogService, useValue: mockAuditLogService },
        { provide: ProductSearchService, useValue: mockProductSearchService },
        { provide: IntegrationModulesService, useValue: mockIntegrationModulesService },
        { provide: CategoryHierarchyService, useValue: mockCategoryHierarchyService },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
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
    mockPrismaService.product.findFirst.mockResolvedValue(null);
    mockPrismaService.product.create.mockResolvedValue({ id: '1' });
    mockPrismaService.product.update.mockResolvedValue({ id: '1' });
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
      mockSearchRows([{ id: '1', name: 'Apple' }]);

      const result = await service.findAll('Apple');

      expect(result.data).toHaveLength(1);
    });

    // JON-198 (21/09/2026): "Ver tudo" das Vitrines Inteligentes filtrava
    // sempre pro catalogo inteiro -- tag reduz pro subconjunto do carrossel.
    it('filtra por tag quando informada (Ver tudo das Vitrines Inteligentes)', async () => {
      const row = { id: '1', name: 'Picanha', active: true, tags: ['churrasco-nobre'] };
      mockPrismaService.product.findMany.mockResolvedValueOnce([row]).mockResolvedValueOnce([row]);

      const result = await service.findAll(undefined, 1, 80, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, 'churrasco-nobre');

      expect(result.data).toHaveLength(1);
      const whereArg = mockPrismaService.product.findMany.mock.calls[0][0].where;
      expect(JSON.stringify(whereArg)).toContain('churrasco-nobre');
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

  describe('syncFromERP - desativacao de produto sumido do feed (22/09/2026)', () => {
    beforeEach(() => {
      mockPrismaService.product.findFirst.mockResolvedValue(null);
      mockPrismaService.product.create.mockResolvedValue({ id: 'novo' });
      mockPrismaService.product.updateMany.mockClear();
    });

    it('primeira vez que some do feed: so marca erpMissingSince, nao desativa ainda', async () => {
      mockSolidcomERPService.syncProducts.mockResolvedValue({
        status: 'success',
        data: [{ ean: '1', name: 'Continua no mix', price: 10, erpProductId: 1 }],
      });
      mockPrismaService.product.findMany.mockResolvedValue([
        { id: 'a', erpProductId: 1, erpMissingSince: null }, // continua no feed
        { id: 'b', erpProductId: 999, erpMissingSince: null }, // sumiu agora, 1a vez
      ]);

      const result = await service.syncFromERP();

      expect(mockPrismaService.product.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['b'] } },
        data: { erpMissingSince: expect.any(Date) },
      });
      expect(mockPrismaService.product.updateMany).not.toHaveBeenCalledWith(
        expect.objectContaining({ data: { active: false } }),
      );
      expect((result as any).deactivation.deactivated).toBe(0);
      expect((result as any).deactivation.markedAsMissing).toBe(1);
    });

    it('desativa produto que ja estava ausente ha mais do tempo minimo', async () => {
      const dezOitoHorasAtras = new Date(Date.now() - 18 * 60 * 60 * 1000);
      mockSolidcomERPService.syncProducts.mockResolvedValue({
        status: 'success',
        data: [{ ean: '1', name: 'Continua no mix', price: 10, erpProductId: 1 }],
      });
      mockPrismaService.product.findMany.mockResolvedValue([
        { id: 'a', erpProductId: 1, erpMissingSince: null },
        { id: 'b', erpProductId: 999, erpMissingSince: dezOitoHorasAtras },
      ]);

      const result = await service.syncFromERP();

      expect(mockPrismaService.product.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['b'] } },
        data: { active: false },
      });
      expect((result as any).deactivation.deactivated).toBe(1);
    });

    it('nao desativa quem esta ausente ha pouco tempo, mesmo ja marcado antes', async () => {
      const umaHoraAtras = new Date(Date.now() - 60 * 60 * 1000);
      mockSolidcomERPService.syncProducts.mockResolvedValue({
        status: 'success',
        data: [{ ean: '1', name: 'Continua no mix', price: 10, erpProductId: 1 }],
      });
      mockPrismaService.product.findMany.mockResolvedValue([
        { id: 'a', erpProductId: 1, erpMissingSince: null },
        { id: 'b', erpProductId: 999, erpMissingSince: umaHoraAtras },
      ]);

      const result = await service.syncFromERP();

      expect(mockPrismaService.product.updateMany).not.toHaveBeenCalledWith(
        expect.objectContaining({ data: { active: false } }),
      );
      expect((result as any).deactivation.deactivated).toBe(0);
      expect((result as any).deactivation.pendingConfirmation).toBe(1);
    });

    it('reapareceu no feed: zera erpMissingSince (autocura de resposta parcial pontual)', async () => {
      const seteHorasAtras = new Date(Date.now() - 7 * 60 * 60 * 1000);
      mockSolidcomERPService.syncProducts.mockResolvedValue({
        status: 'success',
        data: [{ ean: '1', name: 'Reapareceu', price: 10, erpProductId: 1 }],
      });
      mockPrismaService.product.findMany.mockResolvedValue([
        { id: 'a', erpProductId: 1, erpMissingSince: seteHorasAtras },
      ]);

      await service.syncFromERP();

      expect(mockPrismaService.product.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['a'] } },
        data: { erpMissingSince: null },
      });
    });

    it('nao mexe em nada quando todo mundo ativo ainda esta no feed', async () => {
      mockSolidcomERPService.syncProducts.mockResolvedValue({
        status: 'success',
        data: [{ ean: '1', name: 'Continua', price: 10, erpProductId: 1 }],
      });
      mockPrismaService.product.findMany.mockResolvedValue([{ id: 'a', erpProductId: 1, erpMissingSince: null }]);

      const result = await service.syncFromERP();

      expect(mockPrismaService.product.updateMany).not.toHaveBeenCalled();
      expect((result as any).deactivation.deactivated).toBe(0);
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

    // JON-62: sync manual e cron nao compartilhavam a mesma trava --
    // scheduler tinha a sua propria, o service nenhuma. Chamada concorrente
    // agora e pulada em vez de rodar um segundo snapshot em paralelo.
    it('pula sync concorrente em vez de rodar dois snapshots em paralelo', async () => {
      let resolveFirst: (value: unknown) => void = () => {};
      mockSolidcomERPService.syncProducts.mockImplementationOnce(
        () => new Promise((resolve) => { resolveFirst = resolve; }),
      );

      const first = service.syncFromERP();
      const second = await service.syncFromERP();

      expect((second as any).skipped).toBe(true);
      resolveFirst({ status: 'success', data: [] });
      await Promise.race([first, new Promise((resolve) => setTimeout(resolve, 500))]);
    });

    it('should update existing products', async () => {
      mockSolidcomERPService.syncProducts.mockResolvedValue({
        status: 'success',
        data: [{ ean: '123', name: 'Updated', price: 20 }],
      });
      mockPrismaService.product.findFirst.mockResolvedValue({ id: '1', ean: '123' });
      mockPrismaService.product.update.mockResolvedValue({ id: '1', name: 'Updated' });

      await service.syncFromERP();

      expect(mockPrismaService.product.update).toHaveBeenCalled();
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
      mockPrismaService.product.findUnique.mockResolvedValue(null);
      mockPrismaService.product.create.mockResolvedValue({
        id: 'fractional-1',
        ean: '789',
        name: 'Aipim kg',
        price: 8,
        isFractional: true,
        fractionStep: 0.25,
        unit: 'kg',
      });

      await service.syncFromERP();

      expect(mockPrismaService.product.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isFractional: true,
            fractionStep: 0.25,
          }),
        }),
      );
    });

    // JON-192 (fase 2 do JON-179, de-para oficial AEF-045): departamento com
    // correspondencia 1:1 confirmada usa match exato, sem keyword matching.
    it('reconcilia category via de-para oficial (match exato) quando o departamento tem correspondencia 1:1', async () => {
      mockSolidcomERPService.syncProducts.mockResolvedValue({
        status: 'success',
        data: [{
          ean: '888',
          name: 'Racao para gato',
          price: 40,
          ecommerceDepartment: 'Pet Shop',
          ecommerceCategory: 'Gatos',
        }],
      });
      mockPrismaService.product.findUnique.mockResolvedValue(null);
      mockPrismaService.product.create.mockResolvedValue({ id: 'pet-1', ean: '888' });

      await service.syncFromERP();

      expect(mockPrismaService.product.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ category: 'PET_SHOP' }) }),
      );
    });

    // JON-192 (alinhamento AEF-045 14:40): "Bebidas & Adega" resolve por
    // categoriaEcommerce exata (5 categorias canonicas), nunca por keyword.
    it('reconcilia category de bebidas via categoriaEcommerce exata (whisky nao cai em VINHOS)', async () => {
      mockSolidcomERPService.syncProducts.mockResolvedValue({
        status: 'success',
        data: [{
          ean: '777',
          name: 'Whisky Escoces 12 anos',
          price: 150,
          ecommerceDepartment: 'Bebidas & Adega',
          ecommerceCategory: 'Destilados & Aperitivos',
        }],
      });
      mockPrismaService.product.findUnique.mockResolvedValue(null);
      mockPrismaService.product.create.mockResolvedValue({ id: 'destilado-1', ean: '777' });

      await service.syncFromERP();

      expect(mockPrismaService.product.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ category: 'DESTILADOS_COQUETEIS' }) }),
      );
    });

    // JON-192 (fase 2 do JON-179): sem mapping legado de classificacao,
    // departamentoEcommerce/categoriaEcommerce da AntenorApi reconciliam
    // pro CATEGORY_CATALOG via keyword matching -- categoria deixa de cair
    // em NAO_CLASSIFICADO so por o produto nao ter classification01-04.
    it('reconcilia category a partir de departamentoEcommerce quando nao ha mapping legado', async () => {
      mockSolidcomERPService.syncProducts.mockResolvedValue({
        status: 'success',
        data: [{
          ean: '999',
          name: 'Pao frances',
          price: 12,
          ecommerceDepartment: 'Padaria & Confeitaria',
          ecommerceCategory: 'Paes',
        }],
      });
      mockPrismaService.product.findUnique.mockResolvedValue(null);
      mockPrismaService.product.create.mockResolvedValue({ id: 'padaria-1', ean: '999' });

      await service.syncFromERP();

      expect(mockPrismaService.product.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ category: 'PADARIA_CONFEITARIA_CAFE' }) }),
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
      mockSearchRows([
        { id: '1', name: 'Arroz Integral' },
        { id: '2', name: 'Arroz Branco' },
      ]);

      const result = await service.findAll('Arroz');

      expect(result.data).toHaveLength(2);
    });

    it('should handle empty search', async () => {
      mockSearchRows([]);

      const result = await service.findAll('NonExistent');

      expect(result.data).toHaveLength(0);
    });

    it('should search with special characters', async () => {
      mockSearchRows([{ id: '1', name: 'Açúcar' }]);

      const result = await service.findAll('Açúcar');

      expect(result.data).toHaveLength(1);
    });
  });

  // JON-33 (Auditoria 360): webhook produto.alterado manda 1 POST por
  // produto -- uma rajada de N mudancas no ERP não pode virar N syncs quase
  // simultaneos.
  describe('scheduleWebhookProductSync (JON-33)', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      mockPrismaService.product.findMany.mockResolvedValue([]);
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('agrupa uma rajada de chamadas numa unica sync apos o debounce', async () => {
      const spy = jest.spyOn(service, 'syncRecentFromERP').mockResolvedValue({ success: true } as any);

      service.scheduleWebhookProductSync();
      service.scheduleWebhookProductSync();
      service.scheduleWebhookProductSync();

      expect(spy).not.toHaveBeenCalled();

      await jest.advanceTimersByTimeAsync(5000);

      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('agenda mais uma rodada se uma mudanca chegar durante a sync em curso', async () => {
      let resolveFirst!: () => void;
      const spy = jest
        .spyOn(service, 'syncRecentFromERP')
        .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = () => resolve({ success: true } as any); }))
        .mockResolvedValue({ success: true } as any);

      service.scheduleWebhookProductSync();
      await jest.advanceTimersByTimeAsync(5000);
      expect(spy).toHaveBeenCalledTimes(1);

      // Mudanca chega enquanto a primeira sync ainda esta em voo.
      service.scheduleWebhookProductSync();
      resolveFirst();
      await Promise.resolve();
      await Promise.resolve();

      expect(spy).toHaveBeenCalledTimes(2);
    });
  });
});
