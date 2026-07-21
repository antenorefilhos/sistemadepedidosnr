import { Controller, Get, Param, Query } from '@nestjs/common'
import { CategoryHierarchyService } from './category-hierarchy.service'

@Controller('api/categories')
export class CategoriesController {
  constructor(private readonly categoryHierarchy: CategoryHierarchyService) {}

  /**
   * GET /api/categories/hierarchy
   * Retorna hierarquia completa de categorias (N1 com N2)
   */
  @Get('hierarchy')
  async getHierarchy(@Query('activeOnly') activeOnly = 'true') {
    const active = activeOnly === 'true'
    const hierarchy = await this.categoryHierarchy.getCategoryHierarchy(active)
    return {
      success: true,
      data: hierarchy
    }
  }

  /**
   * GET /api/categories/:categoryId/subcategories
   * Retorna sub-categorias (N2) de uma categoria N1
   */
  @Get(':categoryId/subcategories')
  async getSubcategories(@Param('categoryId') categoryId: string) {
    const subcategories = await this.categoryHierarchy.getSubcategories(categoryId)
    return {
      success: true,
      data: subcategories
    }
  }

  /**
   * GET /api/categories/:categoryId
   * Retorna detalhes de uma categoria
   */
  @Get(':categoryId')
  async getCategory(@Param('categoryId') categoryId: string) {
    const category = await this.categoryHierarchy.getCategoryById(categoryId)

    if (!category) {
      return {
        success: false,
        error: 'Categoria não encontrada'
      }
    }

    return {
      success: true,
      data: category
    }
  }

  /**
   * GET /api/categories/:categoryId/mappings
   * Retorna produtos mapeados para uma categoria
   * Query: subcategoryId (opcional), limit, offset
   */
  @Get(':categoryId/mappings')
  async getCategoryMappings(
    @Param('categoryId') categoryId: string,
    @Query('subcategoryId') subcategoryId?: string,
    @Query('limit') limit = '20',
    @Query('offset') offset = '0'
  ) {
    const mappings = await this.categoryHierarchy.getProductsMappedToCategory(categoryId, subcategoryId)

    return {
      success: true,
      data: mappings,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: mappings.length
      }
    }
  }

  /**
   * GET /api/categories/stats/mapping
   * Retorna estatísticas de mapeamento
   */
  @Get('stats/mapping')
  async getMappingStats() {
    const stats = await this.categoryHierarchy.getMappingStats()

    return {
      success: true,
      data: stats
    }
  }

  /**
   * GET /api/categories/pending/list
   * Retorna produtos com classificação pendente
   */
  @Get('pending/list')
  async getPendingMappings(
    @Query('limit') limit = '20',
    @Query('offset') offset = '0'
  ) {
    const pending = await this.categoryHierarchy.getPendingMappings(
      parseInt(limit),
      parseInt(offset)
    )
    const count = await this.categoryHierarchy.countPendingMappings()

    return {
      success: true,
      data: pending,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: count
      }
    }
  }

  /**
   * GET /api/categories/:categoryId/products
   * Retorna produtos mapeados para uma categoria
   * Query: subcategoryId (opcional), limit, offset
   */
  @Get(':categoryId/products')
  async getProductsInCategory(
    @Param('categoryId') categoryId: string,
    @Query('subcategoryId') subcategoryId?: string,
    @Query('limit') limit = '20',
    @Query('offset') offset = '0'
  ) {
    const products = await this.categoryHierarchy.getProductsInCategory(
      categoryId,
      subcategoryId,
      parseInt(limit),
      parseInt(offset)
    )

    return {
      success: true,
      data: products,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        count: products.length
      }
    }
  }}

