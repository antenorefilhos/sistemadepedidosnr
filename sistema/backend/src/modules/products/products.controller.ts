import { Controller, Get, Post, Body, Param, Put, Delete, Query, UseGuards, Patch, Req } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery, ApiBearerAuth } from '@nestjs/swagger'
import { ProductsService } from './products.service'
import { CreateProductDto } from './dto/create-product.dto'
import { UpdateProductDto } from './dto/update-product.dto'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { TenantAccessGuard } from '../../common/guards/tenant-access.guard'
import { PermissionGuard } from '../../common/guards/permission.guard'
import { Roles } from '../../common/decorators/roles.decorator'
import { RequirePermission } from '../../common/decorators/require-permission.decorator'
import { getTenantContext, TenantContextRequest } from '../../common/tenant/tenant-context'

@ApiTags('Products')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get('admin')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Listar produtos (Admin)',
    description: 'Retorna lista paginada e buscável de todos os produtos (requer autenticação de admin).',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Número da página' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Itens por página' })
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Buscar por nome ou SKU' })
  @ApiQuery({ name: 'classification01', required: false, type: String, description: 'Filtro classificação 01' })
  @ApiQuery({ name: 'classification02', required: false, type: String, description: 'Filtro classificação 02' })
  @ApiQuery({ name: 'classification03', required: false, type: String, description: 'Filtro classificação 03' })
  @ApiQuery({ name: 'classification04', required: false, type: String, description: 'Filtro classificação 04' })
  @ApiResponse({
    status: 200,
    description: 'Lista de produtos',
    schema: {
      example: {
        data: [
          {
            id: '1',
            name: 'Produto 1',
            sku: 'SKU001',
            ean: '1234567890',
            price: 100.0,
            quantity: 10,
          },
        ],
        pagination: { page: 1, limit: 10, total: 50 },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Não autenticado' })
  @ApiResponse({ status: 403, description: 'Acesso negado (não é admin)' })
  async findAllAdmin(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('classification01') classification01?: string,
    @Query('classification02') classification02?: string,
    @Query('classification03') classification03?: string,
    @Query('classification04') classification04?: string,
    @Query('outOfStock') outOfStock?: string,
    @Query('inactive') inactive?: string,
    @Query('uncategorized') uncategorized?: string,
    @Req() req?: TenantContextRequest,
  ) {
    return this.productsService.findAllAdmin(
      Number(page) || 1,
      Number(limit) || 10,
      search,
      classification01,
      classification02,
      classification03,
      classification04,
      outOfStock === 'true',
      inactive === 'true',
      uncategorized === 'true',
      req ? getTenantContext(req) : undefined,
    )
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Patch('admin/bulk-status')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Atualizar status de múltiplos produtos em lote',
    description: 'Ativa ou desativa produtos em massa fornecendo um array de IDs.',
  })
  async bulkUpdateStatus(@Body() body: { ids: string[]; active: boolean }) {
    return this.productsService.bulkUpdateStatus(body.ids, body.active)
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post('admin/bulk-delete')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Excluir múltiplos produtos em lote',
    description: 'Exclui permanentemente produtos em massa fornecendo um array de IDs.',
  })
  async bulkDelete(@Body() body: { ids: string[] }) {
    return this.productsService.bulkDelete(body.ids)
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get('admin/mercadological-tree')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Árvore mercadológica Solidcom (Admin)',
    description: 'Retorna os níveis classificacao01..04 para filtros e gestão no admin.',
  })
  @ApiResponse({
    status: 200,
    description: 'Árvore mercadológica agrupada',
  })
  async getMercadologicalTree() {
    return this.productsService.getMercadologicalTree()
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post('admin/taxonomy/sync')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Sincronizar taxonomia de produtos',
    description: 'Atualiza categorias de produtos a partir das classificações e garante categorias CMS correspondentes.',
  })
  @ApiResponse({
    status: 200,
    description: 'Taxonomia sincronizada com sucesso',
  })
  async syncTaxonomy() {
    return this.productsService.syncTaxonomyFromProducts()
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get('admin/availability-metrics')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Métricas de disponibilidade dos produtos',
    description: 'Retorna indicadores de estoque e disponibilidade para monitoramento operacional no admin.',
  })
  @ApiResponse({
    status: 200,
    description: 'Métricas carregadas com sucesso',
  })
  async getAvailabilityMetrics() {
    return this.productsService.getAvailabilityMetrics()
  }

  @Get()
  @ApiOperation({
    summary: 'Listar produtos (Público)',
    description: 'Retorna lista de produtos disponíveis para clientes.',
  })
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Buscar por nome' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Página' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Itens por página (máx 100)' })
  @ApiQuery({ name: 'category', required: false, type: String, description: 'Filtrar por categoria' })
  @ApiQuery({ name: 'minPrice', required: false, type: Number, description: 'Preço mínimo' })
  @ApiQuery({ name: 'maxPrice', required: false, type: Number, description: 'Preço máximo' })
  @ApiResponse({
    status: 200,
    description: 'Lista de produtos paginada',
  })
  @ApiQuery({ name: 'classification01', required: false, type: String, description: 'Filtro mercadologico nivel 1' })
  @ApiQuery({ name: 'classification02', required: false, type: String, description: 'Filtro mercadologico nivel 2' })
  @ApiQuery({ name: 'classification03', required: false, type: String, description: 'Filtro mercadologico nivel 3' })
  @ApiQuery({ name: 'classification04', required: false, type: String, description: 'Filtro mercadologico nivel 4' })
  async findAll(
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('category') category?: string,
    @Query('cat') cat?: string,
    @Query('minPrice') minPrice?: string,
    @Query('maxPrice') maxPrice?: string,
    @Query('classification01') classification01?: string,
    @Query('classification02') classification02?: string,
    @Query('classification03') classification03?: string,
    @Query('classification04') classification04?: string,
    @Req() req?: TenantContextRequest,
  ) {
    return this.productsService.findAll(
      search,
      Number(page) || 1,
      Number(limit) || 80,
      category || cat,
      minPrice ? Number(minPrice) : undefined,
      maxPrice ? Number(maxPrice) : undefined,
      classification01,
      classification02,
      classification03,
      classification04,
      req ? getTenantContext(req) : undefined,
    )
  }

  @Get('mercadological-tree')
  @ApiOperation({
    summary: 'Arvore mercadologica publica',
    description: 'Retorna classificacao01..04 para filtros do Mercado no storefront.',
  })
  @ApiResponse({ status: 200, description: 'Arvore mercadologica publica' })
  async getMercadologicalTreePublic() {
    return this.productsService.getMercadologicalTree()
  }

  @Get('suggest')
  @ApiOperation({
    summary: 'Sugestões de busca',
    description: 'Retorna sugestões rápidas de produtos para autocomplete.',
  })
  @ApiQuery({ name: 'q', required: true, type: String, description: 'Termo parcial digitado' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Máximo de sugestões' })
  @ApiResponse({
    status: 200,
    description: 'Sugestões de busca',
    schema: { example: { data: ['ABACATE kg', 'ABOBORA CABOTIA kg'] } },
  })
  async suggest(@Query('q') query: string, @Query('limit') limit?: string) {
    return this.productsService.suggest(query, Number(limit) || 6)
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post('admin/reindex-search')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Reindexar busca inteligente',
    description: 'Recria o índice de produtos no MeiliSearch.',
  })
  @ApiResponse({
    status: 200,
    description: 'Reindexação concluída',
  })
  async reindexSearch() {
    return this.productsService.reindexSearch()
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get('sync')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Sincronizar com ERP Solidcom',
    description: 'Busca produtos do ERP Solidcom e sincroniza com o banco de dados.',
  })
  @ApiResponse({
    status: 200,
    description: 'Sincronização concluída',
    schema: {
      example: {
        success: true,
        message: 'Sincronização realizada',
        syncedCount: 15,
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Não autenticado' })
  @ApiResponse({ status: 403, description: 'Acesso negado' })
  async syncERPGet() {
    return this.productsService.syncFromERP()
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get('analytics/top')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Produtos mais vendidos',
    description: 'Retorna os produtos mais vendidos ordenados por quantidade ou receita.',
  })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Quantidade máxima de produtos' })
  @ApiResponse({
    status: 200,
    description: 'Top produtos',
    schema: {
      example: [
        {
          id: '1',
          name: 'Produto 1',
          totalQuantity: 150,
          totalRevenue: 15000.0,
        },
      ],
    },
  })
  @ApiResponse({ status: 401, description: 'Não autenticado' })
  async getTopProducts(@Query('limit') limit?: string) {
    return this.productsService.getTopProductsAnalytics(Number(limit) || 5)
  }

  @Get(':id/substitutes')
  @ApiOperation({
    summary: 'Substitutos do produto',
    description: 'Retorna substitutos ativos configurados para ruptura ou checkout.',
  })
  async getSubstitutes(@Param('id') id: string, @Req() req?: TenantContextRequest) {
    return this.productsService.getSubstitutes(id, req ? getTenantContext(req) : undefined)
  }

  @Get(':id/recommendations')
  @ApiOperation({
    summary: 'Produtos recomendados',
    description: 'Retorna produtos frequentemente comprados juntos com este produto (upselling inteligente).',
  })
  @ApiParam({ name: 'id', type: String, description: 'ID do produto de referência' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Máximo de recomendações (padrão: 6)' })
  @ApiResponse({ status: 200, description: 'Lista de produtos recomendados' })
  async getRecommendations(@Param('id') id: string, @Query('limit') limit?: string) {
    return this.productsService.getRecommendations(id, Number(limit) || 6)
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obter produto por ID',
    description: 'Retorna os detalhes de um produto específico.',
  })
  @ApiParam({ name: 'id', type: String, description: 'ID do produto' })
  @ApiResponse({
    status: 200,
    description: 'Detalhes do produto',
  })
  @ApiResponse({
    status: 404,
    description: 'Produto não encontrado',
  })
  async findOne(@Param('id') id: string, @Req() req?: TenantContextRequest) {
    return this.productsService.findOne(id, req ? getTenantContext(req) : undefined)
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post('admin')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Criar produto (Admin)',
    description: 'Cria um novo produto no sistema.',
  })
  @ApiResponse({
    status: 201,
    description: 'Produto criado com sucesso',
  })
  @ApiResponse({
    status: 400,
    description: 'Dados inválidos',
  })
  @ApiResponse({ status: 401, description: 'Não autenticado' })
  async createAdmin(@Body() createProductDto: CreateProductDto, @Req() req?: TenantContextRequest) {
    return this.productsService.create(createProductDto, req ? getTenantContext(req) : undefined)
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post()
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Criar produto',
    description: 'Cria um novo produto (requer autenticação de admin).',
  })
  @ApiResponse({
    status: 201,
    description: 'Produto criado com sucesso',
  })
  @ApiResponse({ status: 401, description: 'Não autenticado' })
  async create(@Body() createProductDto: CreateProductDto, @Req() req?: TenantContextRequest) {
    return this.productsService.create(createProductDto, req ? getTenantContext(req) : undefined)
  }

  @UseGuards(JwtAuthGuard, TenantAccessGuard, RolesGuard, PermissionGuard)
  @Roles('admin')
  @RequirePermission('pricing.write')
  @Put(':id')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Atualizar produto',
    description: 'Atualiza os dados de um produto existente.',
  })
  @ApiParam({ name: 'id', type: String, description: 'ID do produto' })
  @ApiResponse({
    status: 200,
    description: 'Produto atualizado com sucesso',
  })
  @ApiResponse({ status: 401, description: 'Não autenticado' })
  @ApiResponse({ status: 404, description: 'Produto não encontrado' })
  async update(@Param('id') id: string, @Body() updateProductDto: UpdateProductDto, @Req() req?: TenantContextRequest) {
    return this.productsService.update(id, updateProductDto, req ? getTenantContext(req) : undefined)
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Delete(':id')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Deletar produto',
    description: 'Remove um produto do sistema.',
  })
  @ApiParam({ name: 'id', type: String, description: 'ID do produto' })
  @ApiResponse({
    status: 200,
    description: 'Produto deletado com sucesso',
  })
  @ApiResponse({ status: 401, description: 'Não autenticado' })
  @ApiResponse({ status: 404, description: 'Produto não encontrado' })
  async remove(@Param('id') id: string) {
    return this.productsService.remove(id)
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post('sync')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Sincronizar com ERP (POST)',
    description: 'Trigga a sincronização com ERP Solidcom.',
  })
  @ApiResponse({
    status: 200,
    description: 'Sincronização iniciada',
  })
  @ApiResponse({ status: 401, description: 'Não autenticado' })
  async syncERP() {
    return this.productsService.syncFromERP()
  }
}
