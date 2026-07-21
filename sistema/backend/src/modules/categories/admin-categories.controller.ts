import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards } from '@nestjs/common'
import { CategoryHierarchyService } from './category-hierarchy.service'
import { AuthGuard } from '@nestjs/passport'

@Controller('api/admin/categories')
@UseGuards(AuthGuard('jwt'))
export class AdminCategoriesController {
  constructor(private readonly categoryHierarchy: CategoryHierarchyService) {}

  /**
   * POST /api/admin/categories
   * Criar uma nova categoria N1
   */
  @Post()
  async createCategory(@Body() body: { name: string; priority?: number }) {
    if (!body.name) {
      return { success: false, error: 'Nome é obrigatório' }
    }

    const category = await this.categoryHierarchy.createCategory(body.name, body.priority || 0)
    return { success: true, data: category }
  }

  /**
   * POST /api/admin/categories/:parentId/subcategories
   * Criar subcategoria N2
   */
  @Post(':parentId/subcategories')
  async createSubcategory(
    @Param('parentId') parentId: string,
    @Body() body: { name: string; priority?: number }
  ) {
    if (!body.name) {
      return { success: false, error: 'Nome é obrigatório' }
    }

    const subcategory = await this.categoryHierarchy.createSubcategory(parentId, body.name, body.priority || 0)
    return { success: true, data: subcategory }
  }

  /**
   * PUT /api/admin/categories/:categoryId
   * Editar categoria
   */
  @Put(':categoryId')
  async updateCategory(
    @Param('categoryId') categoryId: string,
    @Body() body: { name?: string; active?: boolean; priority?: number }
  ) {
    const updated = await this.categoryHierarchy.updateCategory(categoryId, body)
    return { success: true, data: updated }
  }

  /**
   * DELETE /api/admin/categories/:categoryId
   * Deletar categoria (soft delete ou hard delete)
   */
  @Delete(':categoryId')
  async deleteCategory(@Param('categoryId') categoryId: string, @Query('hard') hard = 'false') {
    const hardDelete = hard === 'true'
    const result = await this.categoryHierarchy.deleteCategory(categoryId, hardDelete)
    return { success: true, message: result }
  }

  /**
   * POST /api/admin/categories/mappings
   * Criar/atualizar mapeamento EAN -> Categoria
   */
  @Post('mappings/create')
  async createMapping(@Body() body: { ean: string; categoryId: string; subcategoryId?: string; priority?: number }) {
    const mapping = await this.categoryHierarchy.createProductCategoryMapping(
      body.ean,
      body.categoryId,
      body.subcategoryId,
      body.priority || 0
    )
    return { success: true, data: mapping }
  }

  /**
   * PUT /api/admin/categories/mappings/:ean
   * Atualizar mapeamento existente
   */
  @Put('mappings/:ean')
  async updateMapping(
    @Param('ean') ean: string,
    @Body() body: { categoryId?: string; subcategoryId?: string; priority?: number }
  ) {
    const updated = await this.categoryHierarchy.updateProductCategoryMapping(ean, body)
    return { success: true, data: updated }
  }

  /**
   * GET /api/admin/categories/mappings/by-ean/:ean
   * Retorna o mapeamento de categoria do storefront para um produto pelo EAN
   * Retorna { found: false } se não existir
   */
  @Get('mappings/by-ean/:ean')
  async getMappingByEan(@Param('ean') ean: string) {
    const mapping = await this.categoryHierarchy.getProductMapping(ean)
    if (!mapping) {
      return { success: true, found: false, data: null }
    }
    return { success: true, found: true, data: mapping }
  }

  /**
   * DELETE /api/admin/categories/mappings/:ean
   * Remover mapeamento
   */
  @Delete('mappings/:ean')
  async deleteMapping(@Param('ean') ean: string) {
    const result = await this.categoryHierarchy.deleteProductCategoryMapping(ean)
    return { success: true, message: result }
  }

  /**
   * POST /api/admin/categories/pending/:id/approve
   * Aprovar mapeamento pendente
   */
  @Post('pending/:id/approve')
  async approvePendingMapping(
    @Param('id') id: string,
    @Body() body: { categoryId: string; subcategoryId?: string; notes?: string }
  ) {
    const result = await this.categoryHierarchy.approvePendingMapping(id, body.categoryId, body.subcategoryId, body.notes)
    return { success: true, message: result }
  }

  /**
   * POST /api/admin/categories/pending/:id/reject
   * Rejeitar mapeamento pendente
   */
  @Post('pending/:id/reject')
  async rejectPendingMapping(
    @Param('id') id: string,
    @Body() body: { notes?: string }
  ) {
    const result = await this.categoryHierarchy.rejectPendingMapping(id, body.notes)
    return { success: true, message: result }
  }

  /**
   * POST /api/admin/categories/apply
   * Safe mode para validação/aplicação de lote de mapeamentos
   */
  @Post('apply')
  async applyMappingsSafeMode(
    @Body()
    body: {
      dryRun?: boolean
      mappings: Array<{
        ean: string
        categoryId: string
        subcategoryId?: string
        priority?: number
      }>
    },
  ) {
    const dryRun = body.dryRun !== false
    const mappings = Array.isArray(body.mappings) ? body.mappings : []

    const result = await this.categoryHierarchy.applyBatchMappingsSafeMode(mappings, dryRun)
    return {
      success: result.ok,
      dryRun: result.dryRun,
      applied: result.applied,
      validation: result.validation,
    }
  }

  /**
   * GET /api/admin/categories/mappings/suggestions
   * Gera sugestões de mapeamento EAN -> categoria com base no catálogo atual
   */
  @Get('mappings/suggestions')
  async getMappingSuggestions(
    @Query('limit') limit = '200',
    @Query('onlyUnmapped') onlyUnmapped = 'true'
  ) {
    const suggestions = await this.categoryHierarchy.generateMappingSuggestions(
      parseInt(limit),
      onlyUnmapped !== 'false'
    )

    return {
      success: true,
      data: suggestions,
      total: suggestions.length,
    }
  }

  /**
   * POST /api/admin/categories/mappings/apply-suggestions
   * Aplica sugestões geradas pelo inferidor em dry-run ou de forma real
   */
  @Post('mappings/apply-suggestions')
  async applyMappingSuggestions(
    @Body() body: { dryRun?: boolean; limit?: number }
  ) {
    const result = await this.categoryHierarchy.applySuggestedMappings(
      body.limit ?? 200,
      body.dryRun !== false
    )

    return {
      success: result.ok,
      dryRun: result.dryRun,
      applied: result.applied,
      validation: result.validation,
    }
  }

  /**
   * POST /api/admin/categories/subcategories/populate
   * Popula N2 automaticamente com base nas classificações dos produtos
   */
  @Post('subcategories/populate')
  async populateSubcategories(
    @Body() body: { dryRun?: boolean; minOccurrences?: number; limitProducts?: number }
  ) {
    const result = await this.categoryHierarchy.populateN2FromClassifications(
      body.dryRun !== false,
      body.minOccurrences ?? 10,
      body.limitProducts ?? 30000,
    )

    return {
      success: result.ok,
      ...result,
    }
  }

  /**
   * POST /api/admin/categories/pending/generate
   * Gera pendências automaticamente para produtos ainda não mapeados
   */
  @Post('pending/generate')
  async generatePendingMappings(
    @Body() body: { limit?: number }
  ) {
    const result = await this.categoryHierarchy.generatePendingForUnmapped(
      body.limit ?? 5000,
    )

    return {
      success: result.ok,
      ...result,
    }
  }

  /**
   * POST /api/admin/categories/pending/resolve-auto
   * Resolve pendências em lote: aprova as com sugestão e rejeita as sem sugestão
   */
  @Post('pending/resolve-auto')
  async resolvePendingAutomatically(
    @Body() body: { limit?: number; dryRun?: boolean }
  ) {
    const result = await this.categoryHierarchy.resolvePendingAutomatically(
      body.limit ?? 5000,
      body.dryRun !== false,
    )

    return {
      success: result.ok,
      ...result,
    }
  }
}
