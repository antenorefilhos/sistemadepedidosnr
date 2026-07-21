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
        expect.objectContaining({ orderBy: { order: 'asc' } }),
      );
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
      expect(mockPrisma.recipe.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { active: true, category: { slug: 'carnes' } } }),
      );
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
      const recipe = { id: '1', title: 'Frango Grelhado', slug: 'frango-grelhado' };
      mockPrisma.recipe.findUnique.mockResolvedValue(recipe);

      const result = await service.findBySlug('frango-grelhado');
      expect(result).toEqual(recipe);
    });

    it('deve lançar NotFoundException para slug inexistente', async () => {
      mockPrisma.recipe.findUnique.mockResolvedValue(null);
      await expect(service.findBySlug('nao-existe')).rejects.toThrow(NotFoundException);
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
