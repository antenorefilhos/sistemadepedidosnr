import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { MeiliSearch } from 'meilisearch'
import { PrismaService } from '../../common/prisma.service'

type SearchFilters = {
  tenantId?: string
  storeId?: string
  category?: string
  minPrice?: number
  maxPrice?: number
  classification01?: string
  classification02?: string
  classification03?: string
  classification04?: string
}

type SearchResultPayload = {
  data: unknown[]
  total: number
  page: number
  limit: number
  hasNextPage: boolean
}

const SYNONYM_GROUPS: string[][] = [
  ['acougue', 'açougue', 'acogue', 'acoguee'],
  ['agua', 'água', 'aguá', 'agya'],
  ['acucar', 'açucar', 'açúcar', 'assucar', 'acucar refinado'],
  ['arroz', 'arros'],
  ['feijao', 'feijão', 'feijon'],
  ['oleo', 'óleo', 'oleu'],
  ['vinagre', 'vingare'],
  ['sal', 'sau'],
  ['cafe', 'café', 'cafee'],
  ['leite', 'leyte'],
  ['uht', 'longa vida', 'caixa', 'tetra pak', 'tetrapak'],
  ['manteiga', 'mantteiga'],
  ['margarina', 'margarna'],
  ['iogurte', 'yogurte', 'iogurt', 'yogurt'],
  ['refrigerante', 'refri', 'refigerante', 'refrijerante', 'refrigeranti'],
  ['suco', 'zuco', 'sumo'],
  ['biscoito', 'bolacha', 'biscoto', 'bixcoito', 'biscoite'],
  ['macarrao', 'macarrão', 'macarao', 'macarro', 'machaão', 'machaao'],
  ['farinha', 'farina', 'fariha'],
  ['fermento', 'fermemto', 'farmente'],
  ['molho', 'moyo', 'molhoo'],
  ['maionese', 'maionesee', 'maionesi', 'maonese', 'mayonese'],
  ['ketchup', 'catchup', 'ketshup', 'ketchap', 'kéchup'],
  ['mostarda', 'mostardae', 'muostarda'],
  ['frango', 'fango', 'frangu', 'frangoo', 'farngo', 'frago', 'franago'],
  ['carne', 'carni', 'carne bovina'],
  ['linguica', 'linguiça', 'lingica', 'linguiza', 'linguissa', 'linguíça'],
  ['salsicha', 'salsichaa', 'salsisha', 'salchicha'],
  ['presunto', 'prezunto', 'presunti'],
  ['mussarela', 'muçarela', 'mucarela', 'mozarela', 'muzarela', 'mossarela'],
  ['queijo', 'quejio', 'queiju'],
  ['ovo', 'ovos', 'ovus'],
  ['abacate', 'abacatte', 'abacaté', 'avocado'],
  ['tomate', 'tomati', 'tomate cereja'],
  ['cebola', 'cebolaa', 'sebola'],
  ['batata', 'batatta', 'batataa'],
  ['cenoura', 'cenora', 'cenoora'],
  ['alface', 'alfase', 'olface', 'alfaci', 'alface crespa'],
  ['banana', 'bananna', 'bananaa'],
  ['maca', 'maçã', 'maça', 'macaa', 'mação'],
  ['limao', 'limão', 'limaum', 'limon'],
  ['laranja', 'laranjja', 'laranjaa'],
  ['mamao', 'mamão', 'mámão', 'papaya'],
  ['melancia', 'melansia', 'melaancia'],
  ['abobora', 'abóbora', 'aboborra', 'abobra'],
  ['sabao', 'sabão', 'savao', 'sabão em po', 'sabão em pó'],
  ['detergente', 'detergenti', 'detergente lava louças'],
  ['desinfetante', 'desinfetanti', 'desinfiante'],
  ['amaciante', 'amasciante', 'amacianti'],
  ['papel higienico', 'papel higiênico', 'papel higienco', 'papel higiencio', 'papel toalha'],
  ['absorvente', 'absorventi', 'absoervente'],
  ['xampu', 'shampoo', 'shampu', 'xampoo', 'champú'],
  ['sabonete', 'savonete', 'saboneti'],
  ['condicionador', 'condicionadro', 'condicionadoor'],
  ['cerveja', 'cerveza', 'cerja', 'cervja', 'ceveja'],
  ['vinho', 'vino', 'vinnho'],
  ['pizza', 'piza', 'piiza'],
  ['pipoca', 'pipoka', 'pipocaa'],
  ['chocolate', 'chcocolate', 'chocolati', 'chocalate', 'xocolate'],
  ['pao', 'pão', 'páo', 'pãoo'],
  ['sorvete', 'sorvet', 'sorveti', 'sorbete'],
  ['gelado', 'gelato', 'geladu'],
  ['congelado', 'congeladu'],
  ['fruta', 'fruta fresca', 'frutas'],
  ['verdura', 'verduras', 'legumes'],
  ['hortifruti', 'hortifruti', 'hortifrutti', 'hortifruite'],
]

function buildSynonymsMap(groups: string[][]): Record<string, string[]> {
  const map: Record<string, string[]> = {}

  for (const rawGroup of groups) {
    const group = Array.from(new Set(rawGroup.map((term) => term.trim().toLowerCase()).filter(Boolean)))
    for (const term of group) {
      map[term] = group.filter((candidate) => candidate !== term)
    }
  }

  return map
}

@Injectable()
export class ProductSearchService implements OnModuleInit {
  private readonly logger = new Logger(ProductSearchService.name)
  private readonly indexName = 'products'
  private readonly host?: string
  private readonly apiKey?: string
  private readonly enabled: boolean

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.host = this.configService.get<string>('MEILI_HOST')
    this.apiKey = this.configService.get<string>('MEILI_MASTER_KEY')
    this.enabled = !!this.host
  }

  async onModuleInit() {
    if (!this.enabled) {
      this.logger.log('MeiliSearch desativado (MEILI_HOST ausente).')
      return
    }

    try {
      const client = this.getClient()
      await client.createIndex(this.indexName, { primaryKey: 'id' }).catch(() => undefined)
      const index = client.index(this.indexName)

      await index.updateSearchableAttributes([
        'name',
        'normalizedName',
        'titleMask',
        'titleMaskShort',
        'alternativeDescription',
        'ean',
        'category',
      ])
      await index.updateFilterableAttributes([
        'active',
        'tenantId',
        'storeId',
        'category',
        'price',
        'syncOption',
        'stock',
        'classification01',
        'classification02',
        'classification03',
        'classification04',
      ])
      await index.updateSortableAttributes(['name', 'price', 'popularityScore'])
      await index.updateTypoTolerance({
        enabled: true,
        minWordSizeForTypos: {
          oneTypo: 4,
          twoTypos: 8,
        },
        disableOnWords: [],
      })
      await index.updateSynonyms(buildSynonymsMap(SYNONYM_GROUPS))
      await index.updateRankingRules([
        'words',
        'typo',
        'proximity',
        'attribute',
        'sort',
        'exactness',
        'popularityScore:desc',
      ])

      const stats = await index.getStats()
      if ((stats.numberOfDocuments || 0) === 0) {
        await this.reindexAll()
        this.logger.log('Indice MeiliSearch inicializado com produtos existentes.')
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'erro desconhecido'
      this.logger.warn(`Falha ao inicializar MeiliSearch: ${message}`)
    }
  }

  isEnabled() {
    return this.enabled
  }

  async searchProducts(
    query: string,
    page: number,
    limit: number,
    filters: SearchFilters,
  ): Promise<SearchResultPayload | null> {
    if (!this.enabled) return null

    try {
      const index = this.getClient().index(this.indexName)
      const offset = (page - 1) * limit
      const clauses = [
        'active = true',
        'syncOption != "NUNCA"',
        '((syncOption = "SEMPRE") OR (syncOption = "ESTOQUE" AND stock > 0))',
      ]

      if (filters.tenantId) {
        clauses.push(`tenantId = "${filters.tenantId.replace(/"/g, '\\"')}"`)
      }
      if (filters.storeId) {
        clauses.push(`storeId = "${filters.storeId.replace(/"/g, '\\"')}"`)
      }
      if (filters.category) {
        clauses.push(`category = "${filters.category.replace(/"/g, '\\"')}"`)
      }
      if (typeof filters.minPrice === 'number') {
        clauses.push(`price >= ${filters.minPrice}`)
      }
      if (typeof filters.maxPrice === 'number') {
        clauses.push(`price <= ${filters.maxPrice}`)
      }
      if (filters.classification01) {
        clauses.push(`classification01 = "${filters.classification01.replace(/"/g, '\\"')}"`)
      }
      if (filters.classification02) {
        clauses.push(`classification02 = "${filters.classification02.replace(/"/g, '\\"')}"`)
      }
      if (filters.classification03) {
        clauses.push(`classification03 = "${filters.classification03.replace(/"/g, '\\"')}"`)
      }
      if (filters.classification04) {
        clauses.push(`classification04 = "${filters.classification04.replace(/"/g, '\\"')}"`)
      }

      const result = await index.search(query, {
        filter: clauses.join(' AND '),
        offset,
        limit,
      })

      const total = result.estimatedTotalHits ?? 0
      return {
        data: result.hits,
        total,
        page,
        limit,
        hasNextPage: page * limit < total,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'erro desconhecido'
      this.logger.warn(`Fallback Prisma acionado (MeiliSearch indisponível): ${message}`)
      return null
    }
  }

  async suggest(query: string, limit: number): Promise<string[]> {
    if (!this.enabled || !query.trim()) return []

    try {
      const index = this.getClient().index(this.indexName)
      const result = await index.search(query, {
        filter: [
          'active = true',
          'syncOption != "NUNCA"',
          '((syncOption = "SEMPRE") OR (syncOption = "ESTOQUE" AND stock > 0))',
        ],
        limit: Math.max(1, Math.min(limit * 3, 30)),
        attributesToRetrieve: ['name'],
      })

      const seen = new Set<string>()
      const suggestions: string[] = []

      for (const hit of result.hits as Array<{ name?: string }>) {
        const name = String(hit.name || '').trim()
        if (!name || seen.has(name.toLowerCase())) continue
        seen.add(name.toLowerCase())
        suggestions.push(name)
        if (suggestions.length >= limit) break
      }

      return suggestions
    } catch {
      return []
    }
  }

  async indexProductById(id: string) {
    if (!this.enabled) return

    const product = await this.prisma.product.findUnique({ where: { id } })
    if (!product) return
    const popularityMap = await this.buildPopularityMap([id])

    await this.getClient().index(this.indexName).addDocuments([
      this.toDocument(product, popularityMap.get(id) ?? 0),
    ])
  }

  async indexProductsByIds(ids: string[]) {
    if (!this.enabled || ids.length === 0) return

    const products = await this.prisma.product.findMany({
      where: { id: { in: ids } },
    })

    if (!products.length) return
    const popularityMap = await this.buildPopularityMap(products.map((p) => p.id))

    await this.getClient().index(this.indexName).addDocuments(
      products.map((p) => this.toDocument(p, popularityMap.get(p.id) ?? 0)),
    )
  }

  async reindexAll() {
    if (!this.enabled) return { enabled: false, indexed: 0 }

    const all = await this.prisma.product.findMany()
    if (all.length === 0) return { enabled: true, indexed: 0 }
    const popularityMap = await this.buildPopularityMap(all.map((p) => p.id))

    const index = this.getClient().index(this.indexName)
    await index.deleteAllDocuments()
    await index.addDocuments(all.map((p) => this.toDocument(p, popularityMap.get(p.id) ?? 0)))

    return { enabled: true, indexed: all.length }
  }

  private getClient() {
    return new MeiliSearch({
      host: this.host!,
      apiKey: this.apiKey,
    })
  }

  private toDocument(product: {
    id: string
    tenantId: string
    storeId: string
    ean: string
    name: string
    alternativeDescription: string | null
    isFractional: boolean
    fractionStep: number | null
    price: number
    promotionalPrice: number | null
    stock: number | null
    unit: string
    badges: string | null
    titleMask: string | null
    titleMaskShort: string | null
    category: string
    active: boolean
    origin: string | null
    syncOption: string
    classification01: string | null
    classification02: string | null
    classification03: string | null
    classification04: string | null
  }, popularityScore: number) {
    return {
      id: product.id,
      tenantId: product.tenantId,
      storeId: product.storeId,
      ean: product.ean,
      name: product.name,
      normalizedName: this.normalizeCatalogName(product.name),
      alternativeDescription: product.alternativeDescription,
      isFractional: product.isFractional,
      fractionStep: product.fractionStep,
      price: product.price,
      promotionalPrice: product.promotionalPrice,
      stock: product.stock,
      unit: product.unit,
      badges: product.badges,
      titleMask: product.titleMask,
      titleMaskShort: product.titleMaskShort,
      category: product.category,
      active: product.active,
      origin: product.origin,
      syncOption: product.syncOption,
      classification01: product.classification01,
      classification02: product.classification02,
      classification03: product.classification03,
      classification04: product.classification04,
      availability: this.resolveAvailability(product),
      popularityScore,
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

  private resolveAvailability(product: { active: boolean; syncOption: string; stock: number | null }) {
    if (!product.active || String(product.syncOption || '').toUpperCase() === 'NUNCA') return 'UNAVAILABLE'
    if (String(product.syncOption || '').toUpperCase() === 'SEMPRE') return 'AVAILABLE'
    return Number(product.stock || 0) > 0 ? 'AVAILABLE' : 'OUT_OF_STOCK'
  }

  private async buildPopularityMap(productIds: string[]) {
    if (productIds.length === 0) return new Map<string, number>()

    const sales = await this.prisma.orderItem.groupBy({
      by: ['productId'],
      where: { productId: { in: productIds } },
      _sum: { quantity: true },
    })

    const engagement = await this.prisma.analyticsEvent.groupBy({
      by: ['entityId'],
      where: {
        entity: 'PRODUCT',
        entityId: { in: productIds },
        type: { in: ['VIEW_PRODUCT', 'ADD_TO_CART'] },
      },
      _count: { _all: true },
    })

    const map = new Map<string, number>()
    for (const id of productIds) map.set(id, 0)

    for (const row of sales) {
      const qty = Number(row._sum.quantity || 0)
      map.set(row.productId, (map.get(row.productId) || 0) + qty * 3)
    }

    for (const row of engagement) {
      const id = row.entityId || ''
      if (!id) continue
      map.set(id, (map.get(id) || 0) + row._count._all)
    }

    return map
  }
}
