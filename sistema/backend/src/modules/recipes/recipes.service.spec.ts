import { Test, TestingModule } from '@nestjs/testing';
import { RecipesService } from './recipes.service';
import { PrismaService } from '../../common/prisma.service';
import { NotFoundException } from '@nestjs/common';

const mockPrisma = {
  recipeCategory: {
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  recipe: {
    findMany: jest.fn(),
    count: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  $transaction: jest.fn(),
};

describe('RecipesService', () => {
  let service: RecipesService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecipesService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<RecipesService>(RecipesService);
  });

  describe('listCategories', () => {
    it('deve retornar lista de categorias ordenadas', async () => {
      const categories = [{ id: '1', name: 'Carnes', slug: 'carnes', order: 1 }];
      mockPrisma.recipeCategory.findMany.mockResolvedValue(categories);

      const result = await service.listCategories();
      expect(result).toEqual(categories);
      expect(mockPrisma.recipeCategory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: [{ order: 'asc' }, { name: 'asc' }] }),
      );
    });

    it('site so recebe categoria ativa com receita publicada', async () => {
      mockPrisma.recipeCategory.findMany.mockResolvedValue([]);
      await service.listCategories();
      const arg = mockPrisma.recipeCategory.findMany.mock.calls.at(-1)[0];
      expect(arg.where.active).toBe(true);
      expect(arg.where.recipes.some.active).toBe(true);
    });
  });

  describe('list', () => {
    it('deve retornar paginação correta', async () => {
      mockPrisma.recipe.findMany.mockResolvedValue([]);
      mockPrisma.recipe.count.mockResolvedValue(0);

      const result = await service.list();
      expect(result).toMatchObject({ data: [], page: 1, limit: 12, total: 0, hasNextPage: false });
    });

    it('deve filtrar por categorySlug quando fornecido', async () => {
      mockPrisma.recipe.findMany.mockResolvedValue([]);
      mockPrisma.recipe.count.mockResolvedValue(0);

      await service.list(true, 'carnes');
      const where = mockPrisma.recipe.findMany.mock.calls.at(-1)[0].where;
      // Site: ativa, publicada (data vazia ou ja passada) e da categoria.
      expect(where).toMatchObject({ active: true, category: { slug: 'carnes' } });
      expect(where.OR).toEqual([{ publishedAt: null }, { publishedAt: { lte: expect.any(Date) } }]);
    });

    it('conta so os ingredientes que da para comprar (productCount)', async () => {
      mockPrisma.recipe.findMany.mockResolvedValue([{
        id: 'r1',
        products: [
          { product: { active: true, syncOption: 'SEMPRE', stock: 0 } },
          { product: { active: true, syncOption: 'ESTOQUE', stock: 0 } },
          { product: { active: false, syncOption: 'SEMPRE', stock: 10 } },
        ],
      }]);
      mockPrisma.recipe.count.mockResolvedValue(1);

      const result = await service.list();
      expect(result.data[0]).toEqual({ id: 'r1', productCount: 1 });
    });

    it('deve calcular hasNextPage corretamente', async () => {
      mockPrisma.recipe.findMany.mockResolvedValue(new Array(12).fill({}));
      mockPrisma.recipe.count.mockResolvedValue(25);

      const result = await service.list(undefined, undefined, 1, 12);
      expect(result.hasNextPage).toBe(true);
    });
  });

  describe('findBySlug', () => {
    it('deve retornar receita existente', async () => {
      const available = { id: 'p1', active: true, syncOption: 'SEMPRE', stock: 0, name: 'Frango', titleMask: 'Frango kg' };
      const missing = { id: 'p2', active: true, syncOption: 'ESTOQUE', stock: 0, name: 'Limao' };
      const recipe = {
        id: '1', title: 'Frango Grelhado', slug: 'frango-grelhado', active: true, publishedAt: null,
        products: [{ productId: 'p1', product: available }, { productId: 'p2', product: missing }],
        relatedTo: [{ relatedRecipe: { active: false, publishedAt: null } }],
      };
      mockPrisma.recipe.findUnique.mockResolvedValue(recipe);

      const result = await service.findBySlug('frango-grelhado');
      // So o que da para comprar, com o nome do site; relacionada nao publicada some.
      expect(result.products).toHaveLength(1);
      expect(result.products[0].product.name).toBe('Frango kg');
      expect(result.relatedTo).toHaveLength(0);
    });

    it('receita agendada para o futuro nao aparece no site', async () => {
      mockPrisma.recipe.findUnique.mockResolvedValue({ id: '1', slug: 'x', active: true, publishedAt: new Date(Date.now() + 3600_000), products: [], relatedTo: [] });
      await expect(service.findBySlug('x')).rejects.toThrow(NotFoundException);
    });

    it('deve lançar NotFoundException para slug inexistente', async () => {
      mockPrisma.recipe.findUnique.mockResolvedValue(null);
      await expect(service.findBySlug('nao-existe')).rejects.toThrow(NotFoundException);
    });

    // JON-156 (Auditoria 360, Low): consulta publica por slug nao filtrava
    // active nenhuma vez -- receita desativada continuava acessivel por
    // quem conhecesse o slug, sem autenticacao.
    it('receita desativada nao aparece pra chamador anonimo (allowInactive=false)', async () => {
      mockPrisma.recipe.findUnique.mockResolvedValue({ id: '1', slug: 'desativada', active: false });
      await expect(service.findBySlug('desativada')).rejects.toThrow(NotFoundException);
    });

    it('receita desativada aparece pra admin (allowInactive=true)', async () => {
      const recipe = { id: '1', slug: 'desativada', active: false, products: [], relatedTo: [] };
      mockPrisma.recipe.findUnique.mockResolvedValue(recipe);
      const result = await service.findBySlug('desativada', true);
      expect(result).toMatchObject({ id: '1', slug: 'desativada' });
    });
  });

  describe('findById', () => {
    it('deve lançar NotFoundException para id inexistente', async () => {
      mockPrisma.recipe.findUnique.mockResolvedValue(null);
      await expect(service.findById('id-inexistente')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('deve criar receita com campos básicos', async () => {
      const dto = { title: 'Bolo de Cenoura', slug: 'bolo-de-cenoura', active: true };
      const created = { id: 'abc', ...dto };
      mockPrisma.recipe.create.mockResolvedValue(created);

      const result = await service.create(dto as any);
      expect(result).toEqual(created);
      expect(mockPrisma.recipe.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('remove', () => {
    it('deve lançar NotFoundException ao deletar id inexistente', async () => {
      mockPrisma.recipe.findUnique.mockResolvedValue(null);
      await expect(service.remove('id-inexistente')).rejects.toThrow(NotFoundException);
    });

    it('deve deletar receita existente', async () => {
      const recipe = { id: '1', title: 'Receita X' };
      mockPrisma.recipe.findUnique.mockResolvedValue(recipe);
      mockPrisma.recipe.delete.mockResolvedValue(recipe);

      const result = await service.remove('1');
      expect(result).toEqual(recipe);
    });
  });
});
