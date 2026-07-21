import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../common/prisma.service'
import { CreateProductDto } from './dto/create-product.dto'
import { UpdateProductDto } from './dto/update-product.dto'
import { SolidcomERPService } from '../../modules/integrations/solidcom-erp.service'
import { AuditLogService } from '../audit-log/audit-log.service'
import { ProductSearchService } from './product-search.service'
import { Prisma } from '@prisma/client'
import { IntegrationModulesService } from '../../modules/integrations/integration-modules.service'
import { CategoryHierarchyService } from '../categories/category-hierarchy.service'
import { TenantContext, tenantStoreWhere } from '../../common/tenant/tenant-context'

type ParsedSearch = {
  text: string
  category?: string
  minPrice?: number
  maxPrice?: number
  excludes: string[]
}

type MercadologicalFilters = {
  classification01?: string
  classification02?: string
  classification03?: string
  classification04?: string
}

type ProductTenantContext = Pick<TenantContext, 'tenantId' | 'storeId'>

type ClassificationTreeLeaf = {
  value: string
}

type ClassificationTreeLevel3 = {
  value: string
  children: ClassificationTreeLeaf[]
}

type ClassificationTreeLevel2 = {
  value: string
  children: ClassificationTreeLevel3[]
}

type ClassificationTreeLevel1 = {
  value: string
  children: ClassificationTreeLevel2[]
}

type TaxonomySyncResult = {
  success: true
  skipped?: boolean
  reason?: string
  productsProcessed: number
  productsRecategorized: number
  productsKeptByRegisteredCategory: number
  productsInferredFromClassification: number
  categoriesDetected: number
  categoriesCreated: number
  categoriesUpdated: number
  categoriesSeededForFuture: number
  mercadologicalRoots: number
}

type ProductAvailabilityMetrics = {
  lowStockProducts: number
  alwaysEnabledWithZeroStock: number
  inactiveWithStock: number
}

type CategoryCatalogItem = {
  code: string
  name: string
  keywords: string[]
}

const QUERY_TERM_ALIASES: Record<string, string> = {
  refigerante: 'refrigerante',
  refrijerante: 'refrigerante',
  refri: 'refrigerante',
  bolacha: 'biscoito',
  bixcoito: 'biscoito',
  biscoto: 'biscoito',
  macarao: 'macarrao',
  mucarela: 'mussarela',
  mozarela: 'mussarela',
  acougue: 'açougue',
  acogue: 'açougue',
  acucar: 'açúcar',
  assucar: 'açúcar',
  agua: 'água',
}

const CATEGORY_CATALOG: CategoryCatalogItem[] = [
  { code: 'MERCEARIA', name: 'Mercearia', keywords: ['mercearia', 'conservas', 'cereais', 'graos', 'grãos', 'arroz', 'feijao', 'feijão', 'macarrao'] },
  { code: 'LATICINIOS', name: 'Laticinios', keywords: ['laticinios', 'laticínios', 'queijo', 'iogurte', 'leite', 'refrigerados', 'balcao', 'balcão', 'frios'] },
  { code: 'UTILIDADES', name: 'Utilidades', keywords: ['utilidades', 'hplu', 'descartaveis', 'descartáveis', 'embalagens', 'copo', 'prato', 'aluminio'] },
  { code: 'CONGELADOS', name: 'Congelados', keywords: ['congelado', 'sorvete', 'massa congelada', 'lasanha', 'nuggets'] },
  { code: 'PET_SHOP', name: 'Pet Shop', keywords: ['pet', 'racao', 'ração', 'cachorro', 'gato', 'areia sanitaria', 'areia sanitária'] },
  { code: 'BEBE', name: 'Bebe', keywords: ['bebe', 'bebê', 'infantil', 'fralda', 'lenço umedecido', 'formula infantil'] },
  { code: 'CHURRASCO', name: 'Churrasco', keywords: ['churrasco', 'espeto', 'carvao', 'assado', 'picanha', 'costela'] },
  { code: 'CARNES_DIA_A_DIA', name: 'Carnes Dia a Dia', keywords: ['acougue', 'açougue', 'bovino', 'suino', 'frango', 'carne', 'peixe', 'linguica'] },
  { code: 'PADARIA', name: 'Padaria', keywords: ['padaria', 'panificacao', 'pao', 'pães', 'bolo', 'confeitaria'] },
  { code: 'CONSUMO_RAPIDO', name: 'Consumo Rapido', keywords: ['congelado', 'pronto', 'lanche', 'snack', 'pizza', 'marmita'] },
  { code: 'GULOSEIMAS', name: 'Guloseimas', keywords: ['chocolate', 'doce', 'bala', 'bombom', 'biscoito', 'guloseima'] },
  { code: 'BEBIDAS', name: 'Bebidas', keywords: ['bebida', 'refrigerante', 'suco', 'agua', 'água', 'energetico', 'energético'] },
  { code: 'VINHOS', name: 'Vinhos', keywords: ['vinho', 'adega', 'espumante', 'whisky', 'gin', 'licor'] },
  { code: 'CERVEJAS', name: 'Cervejas', keywords: ['cerveja', 'lager', 'pilsen', 'ipa', 'long neck', 'chopp'] },
  { code: 'HORTIFRUTI', name: 'Hortifruti', keywords: ['hortifruti', 'fruta', 'verdura', 'legume', 'folhoso'] },
  { code: 'LIMPEZA', name: 'Limpeza', keywords: ['limpeza', 'detergente', 'desinfetante', 'alvejante', 'sabao', 'sabão'] },
  { code: 'HIGIENE_PESSOAL', name: 'Higiene Pessoal', keywords: ['higiene', 'sabonete', 'shampoo', 'desodorante', 'papel higienico', 'papel higiênico'] },
  { code: 'PERFUMARIA', name: 'Perfumaria', keywords: ['perfumaria', 'perfume', 'colonia', 'colônia', 'hidratante', 'maquiagem'] },
]

const CATEGORY_SEED_CODES = CATEGORY_CATALOG.map((item) => item.code)

const CLASSIFICATION_ROOT_FALLBACKS: Array<{ pattern: string; category: string }> = [
  { pattern: '01-mercearia salgada', category: 'MERCEARIA' },
  { pattern: '02-mercearia doce', category: 'GULOSEIMAS' },
  { pattern: '03-bebidas', category: 'BEBIDAS' },
  { pattern: '04-hplu', category: 'UTILIDADES' },
  { pattern: '05-acougue', category: 'CARNES_DIA_A_DIA' },
  { pattern: '06-pereciveis', category: 'CONGELADOS' },
  { pattern: '07-laticinios', category: 'LATICINIOS' },
  { pattern: '08-flv', category: 'HORTIFRUTI' },
  { pattern: '10-espaco gourmet', category: 'ESPACO_GOURMET' },
  { pattern: '11-servico', category: 'SERVICO' },
  { pattern: '13-embalagens', category: 'UTILIDADES' },
  { pattern: '98-patrimonial', category: 'PATRIMONIAL' },
]

@Injectable()
export class ProductsService {
  private readonly useLegacyClassificationMappings = process.env.ENABLE_LEGACY_CLASSIFICATION_MAPPINGS === 'true'

  constructor(
    private prisma: PrismaService,
    private solidcomERPService: SolidcomERPService,
    private auditLogService: AuditLogService,
    private productSearchService: ProductSearchService,
    private integrationModules: IntegrationModulesService,
    private categoryHierarchyService: CategoryHierarchyService,
  ) {}

  /**
   * Motor de Recomendação — Co-purchase (Phase 17)
   * Algoritmo: "Quem comprou X também comprou Y"
   * Busca pedidos que contêm o produto e ranqueia os co-produtos por frequência.
   */
  async getRecommendations(productId: string, limit = 6) {
    // 1. Encontra todos os pedidos que contêm este produto
    const ordersWithProduct = await this.prisma.orderItem.findMany({
      where: { productId },
      select: { orderId: true },
      take: 200, // Limita o escopo para performance
    })

    if (ordersWithProduct.length === 0) {
      // Fallback: retorna produtos populares se não há histórico
      return this.getFallbackRecommendations(productId, limit)
    }

    const orderIds = ordersWithProduct.map((o) => o.orderId)

    // 2. Busca todos os outros produtos nesses mesmos pedidos
    const coItems = await this.prisma.orderItem.findMany({
      where: {
        orderId: { in: orderIds },
        productId: { not: productId }, // Exclui o próprio produto
      },
      select: { productId: true },
    })

    // 3. Calcula frequência de co-ocorrência
    const frequency = new Map<string, number>()
    for (const item of coItems) {
      frequency.set(item.productId, (frequency.get(item.productId) || 0) + 1)
    }

    if (frequency.size === 0) {
      return this.getFallbackRecommendations(productId, limit)
    }

    // 4. Ordena por frequência e pega os top N
    const topIds = [...frequency.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([id]) => id)

    // 5. Retorna os dados completos dos produtos recomendados
    return this.prisma.product.findMany({
      where: {
        id: { in: topIds },
        active: true,
        syncOption: { not: 'NUNCA' },
        OR: [
          { syncOption: 'SEMPRE' },
          { AND: [{ syncOption: { in: ['ESTOQUE', 'ESTQOUE'] } }, { stock: { gt: 0 } }] },
        ],
      },
      select: {
        id: true,
        ean: true,
        name: true,
        titleMask: true,
        titleMaskShort: true,
        price: true,
        promotionalPrice: true,
        unit: true,
        badges: true,
        stock: true,
        isFractional: true,
        fractionStep: true,
      },
    }).then((items) => items.map((item) => this.toCustomerFacingProduct(item)))
  }

  /**
   * Fallback: produtos populares quando não há histórico de co-compra
   */
  private async getFallbackRecommendations(excludeProductId: string, limit: number) {
    const topItems = await this.prisma.orderItem.groupBy({
      by: ['productId'],
      _count: { _all: true },
      where: { productId: { not: excludeProductId } },
      orderBy: { _count: { productId: 'desc' } },
      take: limit,
    })

    const ids = topItems.map((i) => i.productId)
    return this.prisma.product.findMany({
      where: {
        id: { in: ids },
        active: true,
        syncOption: { not: 'NUNCA' },
        OR: [
          { syncOption: 'SEMPRE' },
          { AND: [{ syncOption: { in: ['ESTOQUE', 'ESTQOUE'] } }, { stock: { gt: 0 } }] },
        ],
      },
      select: {
        id: true,
        ean: true,
        name: true,
        titleMask: true,
        titleMaskShort: true,
        price: true,
        promotionalPrice: true,
        unit: true,
        badges: true,
        stock: true,
        isFractional: true,
        fractionStep: true,
      },
    }).then((items) => items.map((item) => this.toCustomerFacingProduct(item)))
  }

  async findAllAdmin(
    page = 1,
    limit = 10,
    search?: string,
    classification01?: string,
    classification02?: string,
    classification03?: string,
    classification04?: string,
    outOfStock?: boolean,
    inactive?: boolean,
    uncategorized?: boolean,
    context?: Partial<ProductTenantContext>,
  ) {
    const safePage = Math.max(1, page)
    const safeLimit = Math.max(1, Math.min(100, limit))
    const skip = (safePage - 1) * safeLimit

    const classificationFilters = [classification01, classification02, classification03, classification04]
      .filter((value): value is string => Boolean(value && value.trim()))
      .map<Prisma.ProductWhereInput>((value) => ({
        OR: [
          { classification01: { contains: value, mode: Prisma.QueryMode.insensitive } },
          { classification02: { contains: value, mode: Prisma.QueryMode.insensitive } },
          { classification03: { contains: value, mode: Prisma.QueryMode.insensitive } },
          { classification04: { contains: value, mode: Prisma.QueryMode.insensitive } },
        ],
      }))

    const where: Prisma.ProductWhereInput = { ...tenantStoreWhere(context) }
    const andFilters: Prisma.ProductWhereInput[] = []

    if (search) {
      andFilters.push({
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { alternativeDescription: { contains: search, mode: 'insensitive' } },
          { ean: { contains: search, mode: 'insensitive' } },
        ],
      })
    }

    if (classificationFilters.length > 0) {
      andFilters.push({ AND: classificationFilters })
    }

    if (outOfStock) {
      andFilters.push({
        OR: [
          { stock: { lte: 0 } },
          { stock: null },
        ],
      })
    }

    if (inactive) {
      andFilters.push({ active: false })
    }

    if (uncategorized) {
      andFilters.push({
        OR: [
          { category: 'GERAL' },
          { category: '' },
        ],
      })
    }

    if (andFilters.length > 0) {
      where.AND = andFilters
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: safeLimit,
      }),
      this.prisma.product.count({ where }),
    ])

    return {
      data,
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.ceil(total / safeLimit) || 1,
    }
  }

  async bulkUpdateStatus(ids: string[], active: boolean) {
    const result = await this.prisma.product.updateMany({
      where: { id: { in: ids } },
      data: { active },
    })

    try {
      await this.auditLogService.log({
        action: active ? 'BULK_ACTIVATE' : 'BULK_DEACTIVATE',
        entity: 'Product',
        entityId: 'multiple',
        changes: { ids, count: result.count },
      })
    } catch (e) {
      // ignore audit log errors
    }

    return { success: true, count: result.count }
  }

  async bulkDelete(ids: string[]) {
    const result = await this.prisma.product.deleteMany({
      where: { id: { in: ids } },
    })

    try {
      await this.auditLogService.log({
        action: 'BULK_DELETE',
        entity: 'Product',
        entityId: 'multiple',
        changes: { ids, count: result.count },
      })
    } catch (e) {
      // ignore audit log errors
    }

    return { success: true, count: result.count }
  }

  async getMercadologicalTree(): Promise<{ data: ClassificationTreeLevel1[] }> {
    const rows = await this.prisma.product.findMany({
      where: {
        active: true,
      },
      select: {
        classification01: true,
        classification02: true,
        classification03: true,
        classification04: true,
      },
      orderBy: [{ classification01: 'asc' }, { classification02: 'asc' }, { classification03: 'asc' }, { classification04: 'asc' }],
    })

    const level1Map = new Map<string, ClassificationTreeLevel1>()

    for (const row of rows) {
      const c1 = row.classification01?.trim()
      const c2 = row.classification02?.trim()
      const c3 = row.classification03?.trim()
      const c4 = row.classification04?.trim()

      if (!c1) continue

      let level1 = level1Map.get(c1)
      if (!level1) {
        level1 = { value: c1, children: [] }
        level1Map.set(c1, level1)
      }

      if (!c2) continue

      let level2 = level1.children.find((item) => item.value === c2)
      if (!level2) {
        level2 = { value: c2, children: [] }
        level1.children.push(level2)
      }

      if (!c3) continue

      let level3 = level2.children.find((item) => item.value === c3)
      if (!level3) {
        level3 = { value: c3, children: [] }
        level2.children.push(level3)
      }

      if (!c4) continue

      if (!level3.children.some((item) => item.value === c4)) {
        level3.children.push({ value: c4 })
      }
    }

    return {
      data: [...level1Map.values()],
    }
  }

  async syncTaxonomyFromProducts(): Promise<TaxonomySyncResult> {
    if (!(await this.integrationModules.isEnabled('solidcom'))) {
      return {
        success: true,
        skipped: true,
        reason: 'Modulo Solidcom desativado',
        productsProcessed: 0,
        productsRecategorized: 0,
        productsKeptByRegisteredCategory: 0,
        productsInferredFromClassification: 0,
        categoriesDetected: 0,
        categoriesCreated: 0,
        categoriesUpdated: 0,
        categoriesSeededForFuture: 0,
        mercadologicalRoots: 0,
      }
    }

    const products = await this.prisma.product.findMany({
      where: { active: true },
      select: {
        id: true,
        name: true,
        alternativeDescription: true,
        category: true,
        classification01: true,
        classification02: true,
        classification03: true,
        classification04: true,
      },
    })

    const idsByCategory = new Map<string, string[]>()
    let productsKeptByRegisteredCategory = 0
    let productsInferredFromClassification = 0

    for (const product of products) {
      const storedCategory = (product.category || '').trim().toUpperCase() || 'NAO_CLASSIFICADO'
      const currentCategory = this.normalizeCategory(product.category) || 'NAO_CLASSIFICADO'
      const hasRegisteredCategory = !this.isPlaceholderCategory(currentCategory)
      const inferredCategory = this.inferCategoryFromMercadologicalPath(
        product.classification01,
        product.classification02,
        product.classification03,
        product.classification04,
        product.name,
        product.alternativeDescription,
      )
      const nextCategory = hasRegisteredCategory ? currentCategory : inferredCategory

      if (hasRegisteredCategory) {
        productsKeptByRegisteredCategory += 1
      } else if (!this.isPlaceholderCategory(inferredCategory)) {
        productsInferredFromClassification += 1
      }

      if (!nextCategory) continue
      if (nextCategory === currentCategory && storedCategory === nextCategory) continue

      const bucket = idsByCategory.get(nextCategory) || []
      bucket.push(product.id)
      idsByCategory.set(nextCategory, bucket)
    }

    let productsRecategorized = 0
    for (const [category, ids] of idsByCategory.entries()) {
      if (ids.length === 0) continue
      const updateResult = await this.prisma.product.updateMany({
        where: { id: { in: ids } },
        data: { category },
      })
      productsRecategorized += updateResult.count
    }

    const groupedCategories = await this.prisma.product.groupBy({
      by: ['category'],
      where: {
        active: true,
      },
      _count: { _all: true },
      orderBy: { category: 'asc' },
    })

    const actualCategoryCodes = groupedCategories
      .map((row) => this.normalizeCategory(row.category || ''))
      .filter((code): code is string => Boolean(code))

    const existingCmsCategories = await this.prisma.category.findMany({
      select: { id: true, name: true, active: true },
    })

    const cmsByKey = new Map<string, { id: string; name: string; active: boolean }>()
    for (const category of existingCmsCategories) {
      cmsByKey.set(this.normalizeCategoryKey(category.name), category)
    }

    let categoriesCreated = 0
    let categoriesUpdated = 0

    const desiredCodes = new Set<string>([...actualCategoryCodes, ...CATEGORY_SEED_CODES])

    for (const code of desiredCodes) {
      const normalizedCode = this.normalizeCategory(code) || 'GERAL'
      const key = this.normalizeCategoryKey(normalizedCode)
      const desiredName = this.toCmsCategoryName(normalizedCode)
      const existing = cmsByKey.get(key)

      if (!existing) {
        const created = await this.prisma.category.create({
          data: {
            name: desiredName,
            active: true,
          },
          select: { id: true, name: true, active: true },
        })

        cmsByKey.set(key, created)
        categoriesCreated += 1
        continue
      }

      if (existing.name !== desiredName || existing.active !== true) {
        await this.prisma.category.update({
          where: { id: existing.id },
          data: {
            name: desiredName,
            active: true,
          },
        })
        categoriesUpdated += 1
      }
    }

    for (const category of existingCmsCategories) {
      if (this.normalizeCategoryKey(category.name) !== 'GERAL') continue
      if (!category.active) continue

      await this.prisma.category.update({
        where: { id: category.id },
        data: { active: false },
      })
      categoriesUpdated += 1
    }

    const tree = await this.getMercadologicalTree()

    return {
      success: true,
      productsProcessed: products.length,
      productsRecategorized,
      productsKeptByRegisteredCategory,
      productsInferredFromClassification,
      categoriesDetected: groupedCategories.length,
      categoriesCreated,
      categoriesUpdated,
      categoriesSeededForFuture: Math.max(0, desiredCodes.size - actualCategoryCodes.length),
      mercadologicalRoots: tree.data.length,
    }
  }

  async findAll(
    search?: string,
    page = 1,
    limit = 80,
    category?: string,
    minPrice?: number,
    maxPrice?: number,
    classification01?: string,
    classification02?: string,
    classification03?: string,
    classification04?: string,
    context?: Partial<ProductTenantContext>,
  ) {
    const safePage = Math.max(1, page)
    const safeLimit = Math.max(1, Math.min(100, limit))
    const skip = (safePage - 1) * safeLimit
    const parsed = this.parseSearchQuery(search)
    const effectiveCategory = this.normalizeCategory(category || parsed.category)
    const effectiveMinPrice = typeof minPrice === 'number' ? minPrice : parsed.minPrice
    const effectiveMaxPrice = typeof maxPrice === 'number' ? maxPrice : parsed.maxPrice
    const mercadologicalFilters: MercadologicalFilters = {
      classification01: this.normalizeClassificationFilter(classification01),
      classification02: this.normalizeClassificationFilter(classification02),
      classification03: this.normalizeClassificationFilter(classification03),
      classification04: this.normalizeClassificationFilter(classification04),
    }
    const effectiveParsed: ParsedSearch = {
      ...parsed,
      minPrice: effectiveMinPrice,
      maxPrice: effectiveMaxPrice,
    }

    // Regra global do storefront: só exibe produtos que estejam em pelo menos
    // um mapeamento de classificação -> categoria.
    const storefrontVisibilityFilter = await this.buildStorefrontVisibilityFilterByMappings()
    if (!storefrontVisibilityFilter) {
      return { data: [], page: safePage, limit: safeLimit, total: 0, hasNextPage: false }
    }

    // Quando uma categoria é selecionada, usa mapeamentos manuais.
    // Se não há mapeamentos para a categoria, retorna vazio (produto não mapeado fica oculto).
    let categoryMappingFilter: Record<string, any> | null | undefined = undefined
    if (effectiveCategory && !mercadologicalFilters.classification01) {
      categoryMappingFilter = await this.buildCategoryFilterFromMappings(effectiveCategory)
      if (categoryMappingFilter === null) {
        // Categoria existe mas não tem mapeamentos — retorna vazio
        return { data: [], page: safePage, limit: safeLimit, total: 0, hasNextPage: false }
      }
    }

    // Busca via MeiliSearch para maior tolerância a erros e melhor relevância.
    const useSearchBackend = false
    if (parsed.text && parsed.excludes.length === 0 && useSearchBackend) {
      const meili = await this.productSearchService.searchProducts(parsed.text, safePage, safeLimit, {
        tenantId: context?.tenantId,
        storeId: context?.storeId,
        category: effectiveCategory,
        minPrice: effectiveMinPrice,
        maxPrice: effectiveMaxPrice,
        classification01: mercadologicalFilters.classification01,
        classification02: mercadologicalFilters.classification02,
        classification03: mercadologicalFilters.classification03,
        classification04: mercadologicalFilters.classification04,
      })
      if (meili && meili.total > 0) {
        return {
          ...meili,
          data: (meili.data as any[]).map((item) => this.toCustomerFacingProduct(item)),
        }
      }
    }

    const where = this.buildPrismaWhere(effectiveParsed, effectiveCategory, mercadologicalFilters)
    Object.assign(where, tenantStoreWhere(context))

    // Enforce de visibilidade global por mapeamento (desktop + mobile)
    where['AND'] = [...(where['AND'] || []), storefrontVisibilityFilter]

    // Sobrepõe o filtro de categoria pelos mapeamentos manuais se disponível
    if (categoryMappingFilter !== undefined) {
      delete where['category']
      where['AND'] = [...(where['AND'] || []), categoryMappingFilter]
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        orderBy: { name: 'asc' },
        skip,
        take: safeLimit,
      }),
      this.prisma.product.count({ where }),
    ])

    if (parsed.text && total === 0 && useSearchBackend) {
      const accentAware = await this.findAllAccentTolerant(
        effectiveParsed,
        safePage,
        safeLimit,
        effectiveCategory,
        mercadologicalFilters,
      )
      if (accentAware.total > 0) {
        return {
          ...accentAware,
          data: (accentAware.data as any[]).map((item) => this.toCustomerFacingProduct(item)),
        }
      }
    }

    return {
      data: data.map((item) => this.toCustomerFacingProduct(item)),
      page: safePage,
      limit: safeLimit,
      total,
      hasNextPage: safePage * safeLimit < total,
    }
  }

  private toAccentInsensitiveRegex(term: string) {
    const escaped = term
      .trim()
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\s+/g, '.*')

    return escaped
      .replace(/[aáàâãä]/gi, '[aáàâãä]')
      .replace(/[eéèêë]/gi, '[eéèêë]')
      .replace(/[iíìîï]/gi, '[iíìîï]')
      .replace(/[oóòôõö]/gi, '[oóòôõö]')
      .replace(/[uúùûü]/gi, '[uúùûü]')
      .replace(/[cç]/gi, '[cç]')
  }

  private async findAllAccentTolerant(
    parsed: ParsedSearch,
    page: number,
    limit: number,
    category?: string,
    mercadologicalFilters?: MercadologicalFilters,
  ) {
    const offset = (page - 1) * limit
    const regex = this.toAccentInsensitiveRegex(parsed.text)
    const excludes = parsed.excludes.map((term) => this.toAccentInsensitiveRegex(term)).filter(Boolean)

    const data = await this.prisma.$queryRaw<any[]>`
      SELECT *
      FROM "products"
      WHERE "active" = true
        AND "syncOption" != 'NUNCA'
        AND (("syncOption" = 'SEMPRE') OR ("syncOption" IN ('ESTOQUE', 'ESTQOUE') AND COALESCE("stock", 0) > 0))
        AND (${category}::text IS NULL OR "category" = ${category})
        AND (${parsed.minPrice}::double precision IS NULL OR "price" >= ${parsed.minPrice})
        AND (${parsed.maxPrice}::double precision IS NULL OR "price" <= ${parsed.maxPrice})
        AND (${mercadologicalFilters?.classification01 || null}::text IS NULL OR "classification01" = ${mercadologicalFilters?.classification01 || null})
        AND (${mercadologicalFilters?.classification02 || null}::text IS NULL OR "classification02" = ${mercadologicalFilters?.classification02 || null})
        AND (${mercadologicalFilters?.classification03 || null}::text IS NULL OR "classification03" = ${mercadologicalFilters?.classification03 || null})
        AND (${mercadologicalFilters?.classification04 || null}::text IS NULL OR "classification04" = ${mercadologicalFilters?.classification04 || null})
        AND (
          "name" ~* ${regex}
          OR COALESCE("alternativeDescription", '') ~* ${regex}
          OR "ean" ILIKE ${`%${parsed.text}%`}
        )
        AND (
          ${excludes.length} = 0
          OR NOT EXISTS (
            SELECT 1
            FROM unnest(${excludes}::text[]) AS ex(pattern)
            WHERE "name" ~* ex.pattern OR COALESCE("alternativeDescription", '') ~* ex.pattern
          )
        )
      ORDER BY "name" ASC
      OFFSET ${offset}
      LIMIT ${limit}
    `

    const totalRows = await this.prisma.$queryRaw<Array<{ total: bigint }>>`
      SELECT COUNT(*)::bigint AS total
      FROM "products"
      WHERE "active" = true
        AND "syncOption" != 'NUNCA'
        AND (("syncOption" = 'SEMPRE') OR ("syncOption" IN ('ESTOQUE', 'ESTQOUE') AND COALESCE("stock", 0) > 0))
        AND (${category}::text IS NULL OR "category" = ${category})
        AND (${parsed.minPrice}::double precision IS NULL OR "price" >= ${parsed.minPrice})
        AND (${parsed.maxPrice}::double precision IS NULL OR "price" <= ${parsed.maxPrice})
        AND (${mercadologicalFilters?.classification01 || null}::text IS NULL OR "classification01" = ${mercadologicalFilters?.classification01 || null})
        AND (${mercadologicalFilters?.classification02 || null}::text IS NULL OR "classification02" = ${mercadologicalFilters?.classification02 || null})
        AND (${mercadologicalFilters?.classification03 || null}::text IS NULL OR "classification03" = ${mercadologicalFilters?.classification03 || null})
        AND (${mercadologicalFilters?.classification04 || null}::text IS NULL OR "classification04" = ${mercadologicalFilters?.classification04 || null})
        AND (
          "name" ~* ${regex}
          OR COALESCE("alternativeDescription", '') ~* ${regex}
          OR "ean" ILIKE ${`%${parsed.text}%`}
        )
        AND (
          ${excludes.length} = 0
          OR NOT EXISTS (
            SELECT 1
            FROM unnest(${excludes}::text[]) AS ex(pattern)
            WHERE "name" ~* ex.pattern OR COALESCE("alternativeDescription", '') ~* ex.pattern
          )
        )
    `

    const total = Number(totalRows[0]?.total || 0)
    return {
      data,
      page,
      limit,
      total,
      hasNextPage: page * limit < total,
    }
  }

  async suggest(query: string, limit = 6) {
    const safeLimit = Math.max(1, Math.min(10, limit))
    const normalizedQuery = this.normalizeFreeTextQuery(query)
    const suggestions = await this.productSearchService.suggest(normalizedQuery, safeLimit)

    if (suggestions.length > 0) {
      return { data: suggestions }
    }

    const fallback = await this.prisma.product.findMany({
      where: {
        active: true,
        syncOption: { not: 'NUNCA' },
        OR: [{ syncOption: 'SEMPRE' }, { AND: [{ syncOption: { in: ['ESTOQUE', 'ESTQOUE'] } }, { stock: { gt: 0 } }] }],
        AND: [
          {
            OR: [
              { name: { contains: normalizedQuery, mode: 'insensitive' } },
              { alternativeDescription: { contains: normalizedQuery, mode: 'insensitive' } },
            ],
          },
        ],
      },
      select: { name: true },
      orderBy: { name: 'asc' },
      take: safeLimit,
    })

    return { data: fallback.map((item) => item.name) }
  }

  async reindexSearch() {
    return this.productSearchService.reindexAll()
  }

  async getTopProductsAnalytics(limit = 5) {
    const safeLimit = Math.max(1, Math.min(20, limit))

    const grouped = await this.prisma.orderItem.groupBy({
      by: ['productId'],
      _sum: {
        quantity: true,
        subtotal: true,
      },
      _count: {
        _all: true,
      },
      orderBy: {
        _sum: {
          quantity: 'desc',
        },
      },
      take: safeLimit,
    })

    const productIds = grouped.map((item) => item.productId)
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true, ean: true },
    })

    const productMap = new Map(products.map((product) => [product.id, product]))

    return grouped.map((item) => {
      const product = productMap.get(item.productId)
      return {
        productId: item.productId,
        name: product?.name || 'Produto removido',
        ean: product?.ean || '-',
        quantity: item._sum.quantity || 0,
        revenue: item._sum.subtotal || 0,
        orders: item._count._all,
      }
    })
  }

  async getAvailabilityMetrics(): Promise<ProductAvailabilityMetrics> {
    const [lowStockProducts, alwaysEnabledWithZeroStock, inactiveWithStock] = await Promise.all([
      this.prisma.product.count({
        where: {
          active: true,
          syncOption: 'ESTOQUE',
          stock: { gte: 1, lt: 5 },
        },
      }),
      this.prisma.product.count({
        where: {
          active: true,
          syncOption: 'SEMPRE',
          OR: [{ stock: null }, { stock: { lte: 0 } }],
        },
      }),
      this.prisma.product.count({
        where: {
          active: false,
          stock: { gt: 0 },
        },
      }),
    ])

    return {
      lowStockProducts,
      alwaysEnabledWithZeroStock,
      inactiveWithStock,
    }
  }

  async findOne(id: string, context?: Partial<ProductTenantContext>) {
    const scopedWhere = tenantStoreWhere(context)
    if (Object.keys(scopedWhere).length > 0) {
      const product = await this.prisma.product.findFirst({
        where: { id, ...scopedWhere },
      })

      if (!product) return null
      return this.toCustomerFacingProduct(product)
    }

    const product = await this.prisma.product.findUnique({
      where: { id },
    })

    if (!product) return null
    return this.toCustomerFacingProduct(product)
  }

  async create(createProductDto: CreateProductDto, context?: Partial<ProductTenantContext>) {
    const product = await this.prisma.product.create({
      data: {
        ...createProductDto,
        ...tenantStoreWhere(context),
        category: this.normalizeCategory(createProductDto.category) || 'NAO_CLASSIFICADO',
      },
    })

    await this.ensureProductMasterFromLegacyProduct(product)
    await this.productSearchService.indexProductById(product.id)
    return product
  }

  async update(id: string, updateProductDto: UpdateProductDto, context?: Partial<ProductTenantContext>) {
    const normalizedCategory =
      updateProductDto.category !== undefined
        ? this.normalizeCategory(updateProductDto.category) || 'NAO_CLASSIFICADO'
        : undefined

    const updateData: UpdateProductDto = {
      ...updateProductDto,
      ...(normalizedCategory !== undefined ? { category: normalizedCategory } : {}),
    }

    const scopedWhere = tenantStoreWhere(context)
    if (Object.keys(scopedWhere).length > 0) {
      const existing = await this.prisma.product.findFirst({ where: { id, ...scopedWhere }, select: { id: true } })
      if (!existing) throw new NotFoundException('Produto nao encontrado para o tenant/loja atual')
    }

    const product = await this.prisma.product.update({
      where: { id },
      data: updateData,
    })

    await this.auditLogService.log({
      action: 'UPDATE_PRODUCT',
      entity: 'PRODUCT',
      entityId: product.id,
      changes: updateData as Record<string, unknown>,
    })

    await this.productSearchService.indexProductById(product.id)
    await this.ensureProductMasterFromLegacyProduct(product)

    return product
  }

  async addMedia(
    productId: string,
    data: { type: string; url: string; alt?: string; sortOrder?: number; isPrimary?: boolean },
    context?: Partial<ProductTenantContext>,
  ) {
    const productMaster = await this.resolveProductMaster(productId, context)
    const type = String(data.type || 'IMAGE').trim().toUpperCase()
    if (!data.url || !String(data.url).trim()) {
      throw new BadRequestException('URL da midia e obrigatoria.')
    }

    if (data.isPrimary && type === 'IMAGE') {
      await this.prisma.productMedia.updateMany({
        where: { productId: productMaster.id, type: 'IMAGE', status: 'ACTIVE' },
        data: { isPrimary: false },
      })
    }

    return this.prisma.productMedia.create({
      data: {
        productId: productMaster.id,
        type,
        url: String(data.url).trim(),
        alt: data.alt || productMaster.name,
        sortOrder: data.sortOrder ?? 0,
        isPrimary: Boolean(data.isPrimary),
      },
    })
  }

  async createSubstitute(
    productId: string,
    data: { substituteId: string; priority?: number; rule?: string },
    context?: Partial<ProductTenantContext>,
  ) {
    if (!data.substituteId) {
      throw new BadRequestException('substituteId e obrigatorio.')
    }
    if (data.substituteId === productId) {
      throw new BadRequestException('Produto nao pode ser substituto dele mesmo.')
    }

    const productMaster = await this.resolveProductMaster(productId, context)
    const substitute = await this.resolveProductMaster(data.substituteId, context)
    await this.assertSubstituteAvailable(substitute)

    return this.prisma.productSubstitution.upsert({
      where: {
        productId_substituteId: {
          productId: productMaster.id,
          substituteId: substitute.id,
        },
      },
      create: {
        productId: productMaster.id,
        substituteId: substitute.id,
        priority: data.priority ?? 0,
        rule: data.rule || 'MANUAL',
      },
      update: {
        priority: data.priority ?? 0,
        rule: data.rule || 'MANUAL',
        status: 'ACTIVE',
      },
      include: {
        substitute: {
          include: { media: true, attributes: true, brand: true },
        },
      },
    })
  }

  async getSubstitutes(productId: string, context?: Partial<ProductTenantContext>) {
    const productMaster = await this.resolveProductMaster(productId, context)
    const rows = await this.prisma.productSubstitution.findMany({
      where: { productId: productMaster.id, status: 'ACTIVE' },
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
      include: {
        substitute: {
          include: { media: true, attributes: true, brand: true },
        },
      },
    })

    const legacyIds = rows.map((row) => row.substitute.legacyProductId).filter((id): id is string => Boolean(id))
    const legacyProducts = legacyIds.length
      ? await this.prisma.product.findMany({
          where: { id: { in: legacyIds } },
          select: {
            id: true,
            price: true,
            promotionalPrice: true,
            stock: true,
            active: true,
            syncOption: true,
            unit: true,
          },
        })
      : []
    const legacyById = new Map(legacyProducts.map((product) => [product.id, product]))

    return {
      productId: productMaster.id,
      legacyProductId: productMaster.legacyProductId,
      data: rows.map((row) => ({
        priority: row.priority,
        rule: row.rule,
        substitute: {
          ...row.substitute,
          legacy: row.substitute.legacyProductId ? legacyById.get(row.substitute.legacyProductId) || null : null,
        },
      })),
    }
  }

  async remove(id: string) {
    const product = await this.prisma.product.update({
      where: { id },
      data: { active: false },
    })

    await this.productSearchService.indexProductById(product.id)
    return product
  }

  async syncFromERP() {
    if (!(await this.integrationModules.isEnabled('solidcom'))) {
      return {
        success: true,
        skipped: true,
        reason: 'Modulo Solidcom desativado',
        products: 0,
        synced: 0,
        errors: 0,
        taxonomy: null,
        data: [],
      }
    }

    const syncResult = await this.solidcomERPService.syncProducts()
    const incomingEans = syncResult.data
      .map((item) => String(item.ean || '').trim())
      .filter((ean) => Boolean(ean))

    const mappings = incomingEans.length
      ? await this.prisma.productCategoryMapping.findMany({
          where: { ean: { in: incomingEans } },
          select: {
            ean: true,
            category: {
              select: { name: true },
            },
          },
        })
      : []

    const mappingByEan = new Map(
      mappings.map((item) => [item.ean, item]),
    )

    let synced = 0
    let errors = 0
    const indexedIds: string[] = []
    const unmappedSyncedEans = new Set<string>()

    for (const item of syncResult.data) {
      try {
        const ean = String(item.ean || '').trim()
        const mapped = mappingByEan.get(ean)
        const mappedCategoryCode = mapped?.category?.name
          ? this.normalizeCategory(mapped.category.name)
          : undefined
        const categoryCode = mappedCategoryCode || 'NAO_CLASSIFICADO'

        const product = await this.prisma.product.upsert({
          where: { ean },
          create: {
            ean,
            name: item.name,
            alternativeDescription: item.alternativeDescription,
            classification01: item.classification01,
            classification02: item.classification02,
            classification03: item.classification03,
            classification04: item.classification04,
            price: item.price,
            promotionalPrice: item.promotionalPrice,
            stock: item.stock,
            isFractional: item.isFractional || false,
            fractionStep: item.fractionStep ?? null,
            unit: item.unit || 'un',
            category: categoryCode,
            syncOption: item.syncOption || 'ESTOQUE',
            badges: item.badges,
            origin: item.origin,
            active: true,
          },
          update: {
            name: item.name,
            alternativeDescription: item.alternativeDescription,
            classification01: item.classification01,
            classification02: item.classification02,
            classification03: item.classification03,
            classification04: item.classification04,
            price: item.price,
            promotionalPrice: item.promotionalPrice,
            stock: item.stock,
            isFractional: item.isFractional || false,
            fractionStep: item.fractionStep ?? null,
            unit: item.unit || 'un',
            category: categoryCode,
            syncOption: item.syncOption || 'ESTOQUE',
            badges: item.badges,
            origin: item.origin,
            active: true,
          },
        })

        await this.ensureProductMasterFromLegacyProduct(product)

        if (!mapped) {
          unmappedSyncedEans.add(ean)
        }

        indexedIds.push(product.id)

        synced += 1
      } catch {
        errors += 1
      }
    }

    if (unmappedSyncedEans.size > 0) {
      await this.generatePendingSuggestionsForSyncedUnmappedEans(Array.from(unmappedSyncedEans))
    }

    const taxonomy = await this.syncTaxonomyFromProducts()

    const result = {
      success: true,
      products: syncResult.data.length,
      synced,
      errors,
      taxonomy,
      data: syncResult.data.slice(0, 20),
    }

    await this.auditLogService.log({
      action: 'SYNC_PRODUCTS',
      entity: 'INTEGRATION_SOLIDCOM',
      entityId: 'products',
      changes: {
        products: result.products,
        synced: result.synced,
        errors: result.errors,
        at: new Date().toISOString(),
      },
    })

    await this.productSearchService.indexProductsByIds(indexedIds)

    return result
  }

  private async ensureProductMasterFromLegacyProduct(product: {
    id: string
    tenantId?: string | null
    ean?: string | null
    name?: string | null
    price?: number | null
    promotionalPrice?: number | null
    category?: string | null
    active?: boolean | null
    unit?: string | null
    isFractional?: boolean | null
    fractionStep?: number | null
    classification01?: string | null
  }) {
    const name = String(product.name || '').trim() || 'Produto sem nome'
    const isWeighted = Boolean(product.isFractional)
    const weightStep = isWeighted ? this.resolvePositiveDecimal(product.fractionStep, 0.001) : null

    return this.prisma.productMaster.upsert({
      where: { legacyProductId: product.id },
      create: {
        tenantId: product.tenantId || 'tenant_default',
        ean: product.ean || null,
        sku: product.ean || null,
        name,
        normalizedName: this.normalizeCatalogName(name),
        status: product.active === false ? 'INACTIVE' : 'ACTIVE',
        unitType: this.toCatalogUnitType(product.unit, isWeighted),
        baseUnit: product.unit || null,
        isWeighted,
        minWeight: weightStep,
        weightStep,
        averageWeight: weightStep,
        isPerishable: this.isPerishableProduct(product),
        legacyProductId: product.id,
        legacyPrice: this.resolvePositiveDecimal(product.price, null),
        legacyPromotionalPrice: this.resolvePositiveDecimal(product.promotionalPrice, null),
        legacyCategory: product.category || null,
      },
      update: {
        tenantId: product.tenantId || 'tenant_default',
        ean: product.ean || null,
        sku: product.ean || null,
        name,
        normalizedName: this.normalizeCatalogName(name),
        status: product.active === false ? 'INACTIVE' : 'ACTIVE',
        unitType: this.toCatalogUnitType(product.unit, isWeighted),
        baseUnit: product.unit || null,
        isWeighted,
        minWeight: weightStep,
        weightStep,
        averageWeight: weightStep,
        isPerishable: this.isPerishableProduct(product),
        legacyPrice: this.resolvePositiveDecimal(product.price, null),
        legacyPromotionalPrice: this.resolvePositiveDecimal(product.promotionalPrice, null),
        legacyCategory: product.category || null,
      },
    })
  }

  private async resolveProductMaster(productId: string, context?: Partial<ProductTenantContext>) {
    const productMaster = await this.prisma.productMaster.findFirst({
      where: {
        ...(context?.tenantId ? { tenantId: context.tenantId } : {}),
        OR: [{ id: productId }, { legacyProductId: productId }],
      },
    })

    if (!productMaster) {
      const legacyProduct = await this.prisma.product.findFirst({
        where: {
          id: productId,
          ...tenantStoreWhere(context),
        },
      })
      if (legacyProduct) return this.ensureProductMasterFromLegacyProduct(legacyProduct)
    }

    if (!productMaster) {
      throw new NotFoundException('Produto canonico nao encontrado.')
    }

    return productMaster
  }

  private async assertSubstituteAvailable(productMaster: { legacyProductId?: string | null; status: string; name: string }) {
    if (productMaster.status !== 'ACTIVE') {
      throw new BadRequestException('Substituto indisponivel.')
    }

    if (!productMaster.legacyProductId) return

    const legacy = await this.prisma.product.findUnique({
      where: { id: productMaster.legacyProductId },
      select: { active: true, syncOption: true, stock: true },
    })

    if (!legacy || legacy.active === false || String(legacy.syncOption || '').toUpperCase() === 'NUNCA') {
      throw new BadRequestException('Substituto indisponivel.')
    }

    const requiresStock = String(legacy.syncOption || 'ESTOQUE').toUpperCase() !== 'SEMPRE'
    if (requiresStock && legacy.stock != null && Number(legacy.stock) <= 0) {
      throw new BadRequestException('Substituto indisponivel.')
    }
  }

  private normalizeCatalogName(name: string) {
    return String(name || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toUpperCase()
  }

  private toCatalogUnitType(unit?: string | null, isWeighted?: boolean) {
    if (isWeighted) return 'VARIABLE_WEIGHT'
    const normalized = String(unit || '').trim().toLowerCase()
    if (['kg', 'quilo'].includes(normalized)) return 'KG'
    if (['g', 'gr', 'grama'].includes(normalized)) return 'G'
    if (['l', 'lt', 'litro'].includes(normalized)) return 'L'
    if (normalized === 'ml') return 'ML'
    if (['cx', 'pack', 'pct', 'fardo'].includes(normalized)) return 'PACK'
    return 'UNIT'
  }

  private resolvePositiveDecimal(value: number | null | undefined, fallback: number | null) {
    const parsed = Number(value)
    if (Number.isFinite(parsed) && parsed > 0) return parsed
    return fallback
  }

  private isPerishableProduct(product: { classification01?: string | null; category?: string | null }) {
    const text = `${product.classification01 || ''} ${product.category || ''}`.toLowerCase()
    return ['flv', 'hort', 'acougue', 'carnes', 'latic', 'frios', 'congel'].some((term) => text.includes(term))
  }

  private async generatePendingSuggestionsForSyncedUnmappedEans(eans: string[]) {
    const normalizedEans = Array.from(new Set(eans.map((ean) => String(ean || '').trim()).filter(Boolean)))
    if (normalizedEans.length === 0) return

    const [mappedRows, existingPendingRows] = await Promise.all([
      this.prisma.productCategoryMapping.findMany({
        where: { ean: { in: normalizedEans } },
        select: { ean: true },
      }),
      this.prisma.categoryMappingPending.findMany({
        where: {
          ean: { in: normalizedEans },
          status: 'PENDING',
        },
        select: { ean: true },
      }),
    ])

    const mappedSet = new Set(mappedRows.map((row) => row.ean))
    const pendingSet = new Set(existingPendingRows.map((row) => row.ean))
    const missingEans = normalizedEans.filter((ean) => !mappedSet.has(ean) && !pendingSet.has(ean))

    if (missingEans.length === 0) return

    const suggestions = await this.categoryHierarchyService.generateMappingSuggestions(Math.max(200, missingEans.length * 2), true)
    const suggestionByEan = new Map(suggestions.map((item) => [item.ean, item]))
    const pendingProducts = await this.prisma.product.findMany({
      where: {
        ean: { in: missingEans },
        active: true,
      },
      select: {
        ean: true,
        name: true,
      },
    })

    if (pendingProducts.length === 0) return

    await this.prisma.$transaction(
      pendingProducts.map((product) => {
        const suggestion = suggestionByEan.get(product.ean)
        return this.prisma.categoryMappingPending.create({
          data: {
            ean: product.ean,
            productName: product.name,
            suggestedCategoryN1: suggestion?.categoryName || null,
            suggestedCategoryN2: null,
            suggestedCategoryId: suggestion?.categoryId || null,
            reason: suggestion ? 'auto_classify' : 'not_found',
            status: 'PENDING',
            notes: suggestion
              ? `Sugestao automatica baseada em aprendizado do handoff: ${suggestion.categoryName}`
              : 'Produto sincronizado sem mapeamento no handoff; revisar manualmente',
          },
        })
      }),
    )
  }

  private parseSearchQuery(search?: string): ParsedSearch {
    const raw = String(search || '').trim()
    if (!raw) {
      return { text: '', excludes: [] }
    }

    let remaining = raw
    const excludes: string[] = []
    let category: string | undefined
    let minPrice: number | undefined
    let maxPrice: number | undefined

    const rangeMatch = remaining.match(/(?:preco|preço)\s*:\s*(\d+(?:[.,]\d+)?)\s*\.\.\s*(\d+(?:[.,]\d+)?)/i)
    if (rangeMatch) {
      minPrice = Number(rangeMatch[1].replace(',', '.'))
      maxPrice = Number(rangeMatch[2].replace(',', '.'))
      remaining = remaining.replace(rangeMatch[0], ' ')
    }

    const singlePriceMatch = remaining.match(/(?:preco|preço)\s*(<=|>=|<|>)\s*(\d+(?:[.,]\d+)?)/i)
    if (singlePriceMatch) {
      const value = Number(singlePriceMatch[2].replace(',', '.'))
      if (singlePriceMatch[1] === '>' || singlePriceMatch[1] === '>=') minPrice = value
      if (singlePriceMatch[1] === '<' || singlePriceMatch[1] === '<=') maxPrice = value
      remaining = remaining.replace(singlePriceMatch[0], ' ')
    }

    const categoryMatch = remaining.match(/(?:cat|categoria)\s*:\s*([\w_-]+)/i)
    if (categoryMatch) {
      category = this.normalizeCategory(categoryMatch[1])
      remaining = remaining.replace(categoryMatch[0], ' ')
    }

    const tokens = remaining.split(/\s+/).filter(Boolean)
    const cleanTokens: string[] = []
    for (const token of tokens) {
      if (token.startsWith('-') && token.length > 1) {
        excludes.push(this.normalizeQueryToken(token.slice(1)))
      } else {
        cleanTokens.push(this.normalizeQueryToken(token))
      }
    }

    return {
      text: cleanTokens.join(' ').trim(),
      category,
      minPrice,
      maxPrice,
      excludes,
    }
  }

    private normalizeQueryToken(token: string) {
    const lower = token.trim().toLowerCase()
    return QUERY_TERM_ALIASES[lower] || token
  }

    private normalizeFreeTextQuery(text: string) {
      return text
        .split(/\s+/)
        .filter(Boolean)
        .map((token) => this.normalizeQueryToken(token))
        .join(' ')
        .trim()
    }

  // Busca os mapeamentos de uma categoria e retorna a condição Prisma.
  // Retorna null se a categoria existe mas não tem mapeamentos (→ esconde produtos).
  // Retorna undefined se a categoria não existe no banco (→ usa filtro legacy por campo category).
  private async buildCategoryFilterFromMappings(categoryCode: string): Promise<Record<string, any> | null | undefined> {
    // Normaliza o código recebido para comparar contra o nome armazenado (que pode ser
    // human-readable como "Hortifruti" ou código como "HORTIFRUTI" ou "FLV")
    const normInput = this.normalizeCategoryKey(categoryCode)

    // Carrega categorias com mapeamentos legados e hierarquia N1/N2
    const allCategories = await this.prisma.category.findMany({
      include: { classificationMappings: true },
    })

    const category = allCategories.find(
      (c) => this.normalizeCategoryKey(c.name) === normInput
    )

    if (!category) return undefined // Categoria não registrada: usa filtro legacy

    // 1) Prioriza mapeamentos legados de classificação quando habilitado e existentes
    if (this.useLegacyClassificationMappings && category.classificationMappings.length > 0) {
      const orConditions = category.classificationMappings.map((m) => {
        const field = `classification0${m.classificationLevel}`
        return { [field]: m.classificationValue }
      })

      return { OR: orConditions }
    }

    // 2) Fallback para o novo modelo EAN -> N1/N2
    // Quando a categoria selecionada é N1, inclui mapeamentos do próprio N1 e de todas as N2 filhas.
    const descendantIds = category.parentId
      ? []
      : allCategories
          .filter((item) => item.parentId === category.id)
          .map((item) => item.id)

    const targetCategoryIds = [category.id, ...descendantIds]

    const eanRows = await this.prisma.productCategoryMapping.findMany({
      where: {
        OR: [
          { categoryId: { in: targetCategoryIds } },
          { subCategoryId: { in: targetCategoryIds } },
        ],
      },
      select: { ean: true },
      take: 30000,
    })

    if (eanRows.length === 0) return null

    return { ean: { in: eanRows.map((row) => row.ean) } }
  }

  // Filtro global do storefront: produto visível somente se casar com algum
  // mapeamento de classificação (em qualquer nível 1..4).
  private async buildStorefrontVisibilityFilterByMappings(): Promise<Record<string, any> | null> {
    // 1) Modelo legado por classificação (apenas quando explicitamente habilitado)
    if (this.useLegacyClassificationMappings) {
      const mappings = await this.prisma.categoryClassificationMapping.findMany({
        select: {
          classificationLevel: true,
          classificationValue: true,
        },
      })

      if (mappings.length > 0) {
      const level1 = new Set<string>()
      const level2 = new Set<string>()
      const level3 = new Set<string>()
      const level4 = new Set<string>()

      for (const mapping of mappings) {
        const value = String(mapping.classificationValue || '').trim()
        if (!value) continue
        if (mapping.classificationLevel === 1) level1.add(value)
        if (mapping.classificationLevel === 2) level2.add(value)
        if (mapping.classificationLevel === 3) level3.add(value)
        if (mapping.classificationLevel === 4) level4.add(value)
      }

      const orConditions: Record<string, any>[] = []
      if (level1.size > 0) orConditions.push({ classification01: { in: Array.from(level1) } })
      if (level2.size > 0) orConditions.push({ classification02: { in: Array.from(level2) } })
      if (level3.size > 0) orConditions.push({ classification03: { in: Array.from(level3) } })
      if (level4.size > 0) orConditions.push({ classification04: { in: Array.from(level4) } })

        if (orConditions.length > 0) return { OR: orConditions }
      }
    }

    // 2) Modelo novo por EAN mapeado (M-CAT)
    const eanRows = await this.prisma.productCategoryMapping.findMany({
      select: { ean: true },
      take: 30000,
    })

    if (eanRows.length === 0) return null

    return { ean: { in: eanRows.map((row) => row.ean) } }
  }

  private buildPrismaWhere(parsed: ParsedSearch, category?: string, mercadologicalFilters?: MercadologicalFilters) {    const where: Record<string, any> = { active: true }
    if (category) where["category"] = category
    if (mercadologicalFilters?.classification01) where['classification01'] = mercadologicalFilters.classification01
    if (mercadologicalFilters?.classification02) where['classification02'] = mercadologicalFilters.classification02
    if (mercadologicalFilters?.classification03) where['classification03'] = mercadologicalFilters.classification03
    if (mercadologicalFilters?.classification04) where['classification04'] = mercadologicalFilters.classification04

    if (typeof parsed.minPrice === "number" || typeof parsed.maxPrice === "number") {
      where["price"] = {
        ...(typeof parsed.minPrice === "number" ? { gte: parsed.minPrice } : {}),
        ...(typeof parsed.maxPrice === "number" ? { lte: parsed.maxPrice } : {}),
      }
    }

    const andConditions: any[] = []
    andConditions.push(
      { syncOption: { not: "NUNCA" } },
      {
        OR: [{ syncOption: "SEMPRE" }, { AND: [{ syncOption: { in: ['ESTOQUE', 'ESTQOUE'] } }, { stock: { gt: 0 } }] }],
      },
    )

    if (parsed.text) {
      andConditions.push({
        OR: [
          { name: { contains: parsed.text, mode: "insensitive" } },
          { alternativeDescription: { contains: parsed.text, mode: "insensitive" } },
          { ean: { contains: parsed.text, mode: "insensitive" } },
        ],
      })
    }

    for (const term of parsed.excludes) {
      andConditions.push({
        NOT: [
          { name: { contains: term, mode: "insensitive" } },
          { alternativeDescription: { contains: term, mode: "insensitive" } },
          { ean: { contains: term, mode: "insensitive" } },
        ],
      })
    }

    if (andConditions.length > 0) where["AND"] = andConditions

    return where
  }

  private normalizeCategory(category?: string) {
    if (!category) return undefined
    const normalized = this
      .normalizeCategoryKey(category)
      .replace(/__+/g, '_')
    if (!normalized) return undefined

    const aliasMap: Record<string, string> = {
      ADEGA: 'VINHOS',
      VINHO: 'VINHOS',
      VINHOS: 'VINHOS',
      GERAL: 'NAO_CLASSIFICADO',
      CERVEJA: 'CERVEJAS',
      CERVEJAS: 'CERVEJAS',
      HIGIENE: 'HIGIENE_PESSOAL',
      FLV: 'HORTIFRUTI',
      HORTI_FRUTI: 'HORTIFRUTI',
      HORTIFRUTI: 'HORTIFRUTI',
    }

    if (aliasMap[normalized]) return aliasMap[normalized]

    return normalized
  }

  private normalizeClassificationFilter(value?: string) {
    const normalized = String(value || '').trim()
    return normalized || undefined
  }

  private inferCategoryFromMercadologicalPath(
    classification01?: string | null,
    classification02?: string | null,
    classification03?: string | null,
    classification04?: string | null,
    name?: string | null,
    alternativeDescription?: string | null,
  ) {
    const source = this.normalizeSourceText(
      `${classification01 || ''} ${classification02 || ''} ${classification03 || ''} ${classification04 || ''} ${name || ''} ${alternativeDescription || ''}`,
    )

    for (const catalogItem of CATEGORY_CATALOG) {
      if (catalogItem.keywords.some((keyword) => source.includes(this.normalizeSourceText(keyword)))) {
        return catalogItem.code
      }
    }

    for (const rule of CLASSIFICATION_ROOT_FALLBACKS) {
      if (source.includes(rule.pattern)) {
        return rule.category
      }
    }

    return this.inferCategoryFromClassificationLabel(classification01, classification02, classification03) || 'NAO_CLASSIFICADO'
  }

  private inferCategoryFromClassificationLabel(
    classification01?: string | null,
    classification02?: string | null,
    classification03?: string | null,
  ) {
    const candidates = [classification01, classification02, classification03]
      .filter((value): value is string => Boolean(value && value.trim()))
      .map((value) => this.normalizeSourceText(value))

    for (const candidate of candidates) {
      const withoutPrefix = candidate.replace(/^\d+\s*[-|]\s*/, '').trim()
      if (!withoutPrefix) continue

      const normalized = this.normalizeCategory(withoutPrefix.replace(/\s+/g, '_'))
      if (normalized && !this.isPlaceholderCategory(normalized)) {
        return normalized
      }
    }

    return undefined
  }

  private isPlaceholderCategory(code?: string) {
    if (!code) return true
    return code === 'GERAL' || code === 'NAO_CLASSIFICADO'
  }

  private toCustomerFacingProduct<T extends { name?: string | null; titleMask?: string | null; titleMaskShort?: string | null }>(product: T) {
    const mask = String(product.titleMask || '').trim() || String(product.titleMaskShort || '').trim()
    if (!mask) return product

    return {
      ...product,
      name: mask,
    }
  }

  private normalizeSourceText(value: string) {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
  }

  private normalizeCategoryKey(value: string) {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
  }

  private toCmsCategoryName(categoryCode: string) {
    const map: Record<string, string> = {
      CHURRASCO: 'Churrasco',
      CARNES_DIA_A_DIA: 'Carnes Dia a Dia',
      PADARIA: 'Padaria',
      CONSUMO_RAPIDO: 'Consumo Rapido',
      GULOSEIMAS: 'Guloseimas',
      BEBIDAS: 'Bebidas',
      VINHOS: 'Vinhos',
      CERVEJAS: 'Cervejas',
      MERCEARIA: 'Mercearia',
      LATICINIOS: 'Laticinios',
      UTILIDADES: 'Utilidades',
      CONGELADOS: 'Congelados',
      PET_SHOP: 'Pet Shop',
      BEBE: 'Bebe',
      HORTIFRUTI: 'Hortifruti',
      LIMPEZA: 'Limpeza',
      HIGIENE_PESSOAL: 'Higiene Pessoal',
      PERFUMARIA: 'Perfumaria',
      ESPACO_GOURMET: 'Espaco Gourmet',
      SERVICO: 'Servico',
      PATRIMONIAL: 'Patrimonial',
      NAO_CLASSIFICADO: 'Nao Classificado',
    }

    const normalizedCode = this.normalizeCategory(categoryCode) || 'GERAL'
    if (map[normalizedCode]) return map[normalizedCode]

    return normalizedCode
      .toLowerCase()
      .split('_')
      .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
      .join(' ')
  }
}
