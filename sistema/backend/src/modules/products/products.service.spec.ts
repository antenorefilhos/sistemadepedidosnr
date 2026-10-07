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
    upsert: jest.fn().mockResolvedValue({}),
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
  getCesta: jest.fn(),
  syncProducts: jest.fn(),
  fetchRecentChanges: jest.fn().mockResolvedValue([]),
  getMostruarioProdutosSalvos: jest.fn().mockResolvedValue([]),
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

    it('should search admin products ignoring accents (via unaccent ids)', async () => {
      mockPrismaService.$queryRaw.mockResolvedValueOnce([{ id: 'agua-1' }]);
      mockPrismaService.product.findMany.mockResolvedValue([{ id: 'agua-1', name: 'Água Coco' }]);
      mockPrismaService.product.count.mockResolvedValue(1);

      await service.findAllAdmin(1, 10, 'agua');

      const where = mockPrismaService.product.findMany.mock.calls.at(-1)[0].where;
      expect(JSON.stringify(where)).toContain('agua-1');
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

    // Revisao do Mercado (07/10/2026): ordenar, so ofertas e secao do departamento.
    describe('refino da lista do Mercado', () => {
      const rows = [
        { id: 'semfoto', ean: 'x1', name: 'Fita Adesiva', price: 9.8, promotionalPrice: null },
        { id: 'caro', ean: 'f1', name: 'Azeite', price: 40, promotionalPrice: null },
        { id: 'oferta', ean: 'f2', name: 'Leite', price: 8, promotionalPrice: 6 },
        { id: 'barato', ean: 'f3', name: 'Sal', price: 3, promotionalPrice: null },
      ]
      const listar = async (options: Record<string, unknown>) => {
        jest.spyOn(require('../../common/product-photos'), 'eansWithPhoto').mockReturnValue(new Set(['f1', 'f2', 'f3']))
        mockPrismaService.product.findMany.mockImplementation(async (args: any) =>
          args.select ? rows : rows.filter((r) => args.where.id.in.includes(r.id)),
        )
        const result = await service.findAll(undefined, 1, 80, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, options as never)
        return result.data.map((p: { id: string }) => p.id)
      }
      afterEach(() => {
        jest.restoreAllMocks()
        mockPrismaService.product.findMany.mockReset().mockResolvedValue([])
      })

      it('sem pedido de ordem, produto sem foto vai para o fim', async () => {
        expect((await listar({})).at(-1)).toBe('semfoto')
      })
      it('menor e maior preco usam o preco de oferta', async () => {
        expect(await listar({ sort: 'menor-preco' })).toEqual(['barato', 'oferta', 'semfoto', 'caro'])
        expect(await listar({ sort: 'maior-preco' })).toEqual(['caro', 'semfoto', 'oferta', 'barato'])
      })
      it('so ofertas deixa so quem tem preco promocional abaixo do normal', async () => {
        expect(await listar({ onSale: true })).toEqual(['oferta'])
      })
      it('secao filtra pelo ecommerceCategory', async () => {
        await listar({ section: 'Bovinos' })
        const where = mockPrismaService.product.findMany.mock.calls[0][0].where
        expect(where.AND).toContainEqual({ ecommerceCategory: 'Bovinos' })
      })
    });
  });

  describe('findOne', () => {
    it('should return product by ID', async () => {
      const mockProduct = { id: '1', name: 'Product', price: 100 };
      mockPrismaService.product.findFirst.mockResolvedValue(mockProduct);

      const result = await service.findOne('1');

      expect(result.id).toBe('1');
    });

    it('id so com digitos resolve pelo erpProductId (URL limpa /p/<nome>-<id>)', async () => {
      mockPrismaService.product.findFirst.mockResolvedValue({ id: 'cabc', erpProductId: 22030, name: 'Vinho', price: 10 });

      await service.findOne('22030');

      expect(mockPrismaService.product.findFirst).toHaveBeenLastCalledWith({ where: expect.objectContaining({ erpProductId: 22030 }) });
    });

    it('should return null for invalid ID', async () => {
      mockPrismaService.product.findFirst.mockResolvedValue(null);

      const result = await service.findOne('invalid');

      expect(result).toBeNull();
    });
  });

  describe('getRecommendations (pagina do produto, 07/10/2026)', () => {
    const p = (id: string, category: string, tags: string[], extra: Record<string, unknown> = {}) => ({
      id, ean: `ean-${id}`, erpProductId: null, name: id, category, tags, price: 10, stock: 5, ...extra,
    })
    const comVitrine = (ids: string[]) => {
      mockPrismaService.productCategoryMapping.findMany.mockResolvedValue(ids.map((id) => ({ ean: `ean-${id}` })))
      jest.spyOn(require('../../common/product-photos'), 'eansWithPhoto').mockReturnValue(new Set(ids.map((id) => `ean-${id}`)))
    }
    afterEach(() => jest.restoreAllMocks())

    it('produto com missao recebe so itens da missao, outra categoria antes da propria', async () => {
      mockPrismaService.product.findUnique.mockResolvedValue({ category: 'ADEGA_VINHOS_ESPUMANTES', tags: ['queijos-e-vinhos'], erpProductId: null })
      mockPrismaService.product.findMany.mockResolvedValue([
        p('v2', 'ADEGA_VINHOS_ESPUMANTES', ['queijos-e-vinhos']),
        p('q1', 'QUEIJOS_FRIOS_LATICINIOS', ['queijos-e-vinhos']),
        p('q2', 'QUEIJOS_FRIOS_LATICINIOS', ['queijos-e-vinhos']),
        p('s1', 'ACOUGUE_CHURRASCO', ['queijos-e-vinhos', 'churrasco']),
        p('y1', 'QUEIJOS_FRIOS_LATICINIOS', ['cafe-da-manha']),
        p('semFoto', 'QUEIJOS_FRIOS_LATICINIOS', ['queijos-e-vinhos']),
      ])
      comVitrine(['v2', 'q1', 'q2', 's1', 'y1'])

      const ids = (await service.getRecommendations('v1', 6)).map((r: { id: string }) => r.id)

      expect(new Set(ids.slice(0, 3))).toEqual(new Set(['q1', 'q2', 's1']))
      expect(ids[3]).toBe('v2')
      expect(ids).not.toContain('y1')
      expect(ids).not.toContain('semFoto')
    })

    it('da cesta so entra par observado (origem produto), primeiro; o recuo por categoria fica de fora', async () => {
      mockPrismaService.product.findUnique.mockResolvedValue({ category: 'ACOUGUE_CHURRASCO', tags: [], erpProductId: 4696 })
      mockAntenorApiService.getCesta.mockResolvedValue({
        versao: 13,
        itens: [
          { cdProduto: 900, origem: 'produto', pontuacao: 9 },
          { cdProduto: 800, origem: 'produto', pontuacao: 8 },
          { cdProduto: 1484, origem: 'categoria', pontuacao: 1 },
        ],
      })
      mockPrismaService.product.findMany.mockResolvedValue([
        p('b', 'CERVEJAS_CHOPP', [], { erpProductId: 800 }),
        p('a', 'BAZAR_UTILIDADES', [], { erpProductId: 900 }),
        p('h', 'HORTIFRUTI_ORGANICOS', []),
      ])
      comVitrine(['a', 'b', 'h'])

      const ids = (await service.getRecommendations('picanha', 3)).map((r: { id: string }) => r.id)

      expect(ids).toEqual(['a', 'b', 'h'])
      const where = mockPrismaService.product.findMany.mock.calls.at(-1)[0].where
      expect(where.AND[0].OR).toContainEqual({ erpProductId: { in: [900, 800] } })
    })

    it('com menos de 4 itens da missao, cai no compre junto (e o item vem com as tags)', async () => {
      mockPrismaService.product.findUnique.mockResolvedValue({ category: 'QUEIJOS_FRIOS_LATICINIOS', tags: ['cafe-da-manha'], erpProductId: null })
      mockPrismaService.product.findMany.mockResolvedValue([
        p('pao', 'PADARIA_CONFEITARIA_CAFE', ['cafe-da-manha']),
        p('vinho', 'ADEGA_VINHOS_ESPUMANTES', []),
        p('arroz', 'MERCEARIA_DESPENSA', []),
      ])
      comVitrine(['pao', 'vinho', 'arroz'])

      const result = await service.getRecommendations('requeijao', 6)

      expect(result.map((r: { id: string }) => r.id)).toEqual(['pao', 'vinho'])
      expect(result[0].tags).toEqual(['cafe-da-manha'])
    })
  })

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

  describe('syncFromERP - rebaixa SEMPRE nao validado pelo Motor de Presenca Real (23/09/2026)', () => {
    beforeEach(() => {
      mockPrismaService.product.findFirst.mockResolvedValue(null);
      mockPrismaService.product.create.mockResolvedValue({ id: 'novo' });
      mockPrismaService.product.updateMany.mockClear();
      mockIntegrationModulesService.isEnabled.mockImplementation((key: string) => Promise.resolve(key === 'antenorapi'));
    });

    afterEach(() => {
      mockIntegrationModulesService.isEnabled.mockImplementation((key: string) => Promise.resolve(key === 'solidcom'));
      mockPrismaService.product.findMany.mockReset().mockResolvedValue([]);
    });

    // product.findMany e chamado por 3 rotinas diferentes no mesmo sync
    // (taxonomia, desativacao por ausencia, esse rebaixamento) -- roteia pelo
    // formato do `where` em vez de depender da ORDEM das chamadas, que muda
    // toda vez que uma dessas rotinas ganha/perde uma chamada extra.
    function routeFindManyByWhere(candidatosSempre: unknown[]) {
      return (args: { where?: Record<string, unknown> }) => {
        const where = args?.where || {};
        if (where.syncOption === 'SEMPRE') return Promise.resolve(candidatosSempre);
        return Promise.resolve([]); // taxonomia e deactivateMissingFromErp: sem produto no cenario
      };
    }

    it('rebaixa pra ESTOQUE quem tem SEMPRE+estoque<=0 mas nao aparece nos salvos do motor', async () => {
      mockAntenorApiService.syncProducts.mockResolvedValue({ status: 'success', data: [] });
      mockAntenorApiService.getMostruarioProdutosSalvos.mockResolvedValue([{ cdProduto: 1 }]);
      mockPrismaService.product.findMany.mockImplementation(routeFindManyByWhere([
        { id: 'a', erpProductId: 1 }, // validado pelo motor, nao mexe
        { id: 'b', erpProductId: 999 }, // NAO validado, rebaixa
      ]));

      const result = await service.syncFromERP();

      expect(mockPrismaService.product.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['b'] } },
        data: { syncOption: 'ESTOQUE' },
      });
      expect((result as any).semprePresenceCheck.downgraded).toBe(1);
    });

    it('nao mexe em nada quando todo SEMPRE+estoque<=0 esta validado pelo motor', async () => {
      mockAntenorApiService.syncProducts.mockResolvedValue({ status: 'success', data: [] });
      mockAntenorApiService.getMostruarioProdutosSalvos.mockResolvedValue([{ cdProduto: 1 }]);
      mockPrismaService.product.findMany.mockImplementation(routeFindManyByWhere([{ id: 'a', erpProductId: 1 }]));

      const result = await service.syncFromERP();

      expect(mockPrismaService.product.updateMany).not.toHaveBeenCalledWith(
        expect.objectContaining({ data: { syncOption: 'ESTOQUE' } }),
      );
      expect((result as any).semprePresenceCheck.downgraded).toBe(0);
    });

    it('nao roda quando a fonte do sync e o Solidcom, nao a AntenorApi', async () => {
      mockIntegrationModulesService.isEnabled.mockImplementation((key: string) => Promise.resolve(key === 'solidcom'));
      mockSolidcomERPService.syncProducts.mockResolvedValue({ status: 'success', data: [] });
      mockPrismaService.product.findMany.mockImplementation(routeFindManyByWhere([]));

      const result = await service.syncFromERP();

      expect(mockAntenorApiService.getMostruarioProdutosSalvos).not.toHaveBeenCalled();
      expect((result as any).semprePresenceCheck.skipped).toBe(true);
    });
  });

  describe('syncFromERP - EAN que o ERP passou para outro produto (30/09/2026)', () => {
    it('libera o EAN do produto que saiu do feed antes de gravar o novo dono', async () => {
      mockSolidcomERPService.syncProducts.mockResolvedValue({
        status: 'success',
        data: [{ ean: '1500', name: 'File Salmao', price: 10, erpProductId: 24446 }],
      });
      mockPrismaService.product.findFirst.mockResolvedValue({ id: 'novo-dono', erpProductId: 24446, ean: '5633' });
      mockPrismaService.product.findMany.mockImplementation((args: { where?: { ean?: unknown } }) =>
        Promise.resolve(args?.where?.ean ? [{ id: 'antigo', ean: '1500', erpProductId: 5036 }] : []),
      );

      const result = await service.syncFromERP();

      expect(mockPrismaService.product.update).toHaveBeenCalledWith({ where: { id: 'antigo' }, data: { ean: '1500#5036', active: false } });
      expect(mockPrismaService.product.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'novo-dono' }, data: expect.objectContaining({ ean: '1500' }) }));
      expect((result as any).errors).toBe(0);
      mockPrismaService.product.findMany.mockReset().mockResolvedValue([]);
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

    // 25/09/2026: produto sem erpProductId (seed ficticio 789100xx) tambem e
    // avaliado, casado por EAN -- antes ficava no ar para sempre.
    it('produto sem erpProductId: presente pelo EAN fica, ausente e marcado', async () => {
      mockSolidcomERPService.syncProducts.mockResolvedValue({
        status: 'success',
        data: [{ ean: '1', name: 'Continua no mix', price: 10, erpProductId: 1 }],
      });
      mockPrismaService.product.findMany.mockResolvedValue([
        { id: 'real', ean: '1', erpProductId: null, erpMissingSince: null },
        { id: 'seed', ean: '78910013', erpProductId: null, erpMissingSince: null },
      ]);

      await service.syncFromERP();

      expect(mockPrismaService.product.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['seed'] } },
        data: { erpMissingSince: expect.any(Date) },
      });
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
        data: { active: false, erpActive: false },
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
    // 25/09/2026: departamento da AntenorApi vence o mapping legado e
    // regrava product_category_mappings (o que a navegacao do site le).
    it('departamento vence mapping legado e regrava o mapping da navegacao', async () => {
      mockSolidcomERPService.syncProducts.mockResolvedValue({
        status: 'success',
        data: [{ ean: '555', name: 'Cafe Torrado', price: 20, ecommerceDepartment: 'Mercearia & Despensa' }],
      });
      mockPrismaService.productCategoryMapping.findMany.mockResolvedValueOnce([
        { ean: '555', categoryId: 'cat-doces', category: { name: 'Doces, Chocolates & Snacks' } },
      ]);
      mockPrismaService.category.findMany.mockResolvedValueOnce([
        { id: 'cat-doces', name: 'Doces, Chocolates & Snacks' },
        { id: 'cat-mercearia', name: 'Mercearia & Despensa' },
      ]);
      mockPrismaService.product.findUnique.mockResolvedValue(null);
      mockPrismaService.product.create.mockResolvedValue({ id: 'cafe-1', ean: '555' });

      await service.syncFromERP();

      expect(mockPrismaService.product.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ category: 'MERCEARIA_DESPENSA' }) }),
      );
      expect(mockPrismaService.productCategoryMapping.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ where: { ean: '555' }, update: expect.objectContaining({ categoryId: 'cat-mercearia' }) }),
      );
    });
  });

  describe('fractional products', () => {
    it('should return fractional 0.1', async () => {
      mockPrismaService.product.findFirst.mockResolvedValue({
        id: '1',
        isFractional: true,
        fractionStep: 0.1,
      });

      const result = await service.findOne('1');

      expect(result.fractionStep).toBe(0.1);
    });

    it('should return fractional 0.2', async () => {
      mockPrismaService.product.findFirst.mockResolvedValue({
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
      mockPrismaService.product.findFirst.mockResolvedValue({
        id: '3',
        isFractional: true,
        fractionStep: 0.5,
      });

      const result = await service.findOne('3');

      expect(result.fractionStep).toBe(0.5);
    });

    it('should return non-fractional product', async () => {
      mockPrismaService.product.findFirst.mockResolvedValue({
        id: '4',
        isFractional: false,
        fractionStep: null,
      });

      const result = await service.findOne('4');

      expect(result.isFractional).toBe(false);
    });

    it('should validate fractionStep range', async () => {
      mockPrismaService.product.findFirst.mockResolvedValue({
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
      mockPrismaService.product.findFirst.mockResolvedValue({
        id: '1',
        price: 100,
        promotionalPrice: 75,
      });

      const result = await service.findOne('1');

      expect(result.promotionalPrice).toBe(75);
    });

    it('should handle null promotional price', async () => {
      mockPrismaService.product.findFirst.mockResolvedValue({
        id: '1',
        price: 50,
        promotionalPrice: null,
      });

      const result = await service.findOne('1');

      expect(result.promotionalPrice).toBeNull();
      expect(result.price).toBe(50);
    });

    it('should handle zero price', async () => {
      mockPrismaService.product.findFirst.mockResolvedValue({
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
      mockPrismaService.product.findFirst.mockResolvedValue({
        id: '1',
        active: true,
        stock: 100,
      });

      const result = await service.findOne('1');

      expect(result.stock).toBeGreaterThan(0);
    });

    it('should handle out of stock', async () => {
      mockPrismaService.product.findFirst.mockResolvedValue({
        id: '1',
        active: true,
        stock: 0,
      });

      const result = await service.findOne('1');

      expect(result.stock).toBe(0);
    });

    it('should handle inactive product', async () => {
      mockPrismaService.product.findFirst.mockResolvedValue({
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

describe('departmentCategories (vitrines independentes da arvore do ERP, ORD-025)', () => {
  const { departmentCategories } = jest.requireActual('./products.service')
  it('departamento 1:1 vira a categoria do site', () => {
    expect(departmentCategories('Hortifruti & Orgânicos')).toEqual(['HORTIFRUTI_ORGANICOS'])
  })
  it('"Bebidas & Adega" cobre as 4 categorias de bebida', () => {
    expect(departmentCategories('Bebidas & Adega')?.sort()).toEqual(['ADEGA_VINHOS_ESPUMANTES', 'CERVEJAS_CHOPP', 'DESTILADOS_COQUETEIS', 'SUCOS_REFRIGERANTES'])
  })
  it('valor da arvore do ERP nao e departamento', () => {
    expect(departmentCategories('05 - HORTIFRUTI & FLV')).toBeNull()
  })
})

describe('v3CategoryCode (categoria do site pela arvore v3 do ERP)', () => {
  const { v3CategoryCode } = jest.requireActual('./products.service')
  it('casos que o departamento e-commerce errava', () => {
    expect(v3CategoryCode('Mercearia Salgada', 'Massas')).toBe('MERCEARIA_DESPENSA') // talharim
    expect(v3CategoryCode('Mercearia Salgada', 'Arroz, Feijão e Grãos')).toBe('MERCEARIA_DESPENSA') // ervilha seca
    expect(v3CategoryCode('Açougue e Peixaria', 'Bovinos')).toBe('ACOUGUE_CHURRASCO') // chã
  })
  it('segundo nivel decide onde o departamento cobre mais de uma categoria', () => {
    expect(v3CategoryCode('Adega e Cervejas', 'Vinhos')).toBe('ADEGA_VINHOS_ESPUMANTES')
    expect(v3CategoryCode('Adega e Cervejas', 'Cervejas')).toBe('CERVEJAS_CHOPP')
    expect(v3CategoryCode('Mercearia Doce', 'Panificação Industrial')).toBe('PADARIA_CONFEITARIA_CAFE')
  })
  it('arvore antiga ou desconhecida nao decide (cai no caminho anterior)', () => {
    expect(v3CategoryCode('04 - CARNES, AVES & PEIXARIA', '01 - AVES')).toBeUndefined()
    expect(v3CategoryCode(null, null)).toBeUndefined()
  })
})
