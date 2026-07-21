import { Injectable } from '@nestjs/common'
import { existsSync, readFileSync } from 'fs'
import { basename } from 'path'
import { PrismaService } from '../../common/prisma.service'

type MappingSuggestion = {
  ean: string
  productName: string
  categoryId: string
  categoryName: string
  source: 'product.category' | 'mercadological_inference'
  reason: string
}

type HandoffLearningRow = {
  categoryN1: string
  categoryN2: string
  ean: string
  productName: string
  classification: string
  publication: string
}

type CategoryLearningProfile = {
  categoryId: string
  categoryName: string
  tokenCounts: Map<string, number>
  totalWeight: number
  exampleCount: number
}

type LearningIndex = {
  profiles: CategoryLearningProfile[]
  categoryByName: Map<string, { id: string; name: string }>
  tokenCategorySpread: Map<string, number>
}

type PopulateN2Result = {
  ok: boolean
  dryRun: boolean
  scannedProducts: number
  detectedCandidates: number
  toCreate: number
  created: number
  skippedByLowFrequency: number
  samples: Array<{ parentName: string; subcategoryName: string; frequency: number }>
}

type PendingGenerationResult = {
  ok: boolean
  scannedProducts: number
  created: number
  skippedExistingPending: number
  withSuggestion: number
  withoutSuggestion: number
}

type PendingResolutionResult = {
  ok: boolean
  dryRun: boolean
  scannedPending: number
  approveCandidates: number
  rejectCandidates: number
  approved: number
  rejected: number
}

const CATEGORY_CATALOG: Array<{ code: string; name: string; keywords: string[] }> = [
  { code: 'MERCEARIA', name: 'Mercearia', keywords: ['mercearia', 'conservas', 'cereais', 'graos', 'grãos', 'arroz', 'feijao', 'feijão', 'macarrao'] },
  { code: 'LATICINIOS', name: 'Laticinios', keywords: ['laticinios', 'laticínios', 'queijo', 'iogurte', 'leite', 'refrigerados', 'balcao', 'balcão', 'frios'] },
  { code: 'UTILIDADES', name: 'Utilidades', keywords: ['utilidades', 'hplu', 'descartaveis', 'descartáveis', 'embalagens', 'copo', 'prato', 'aluminio'] },
  { code: 'CONGELADOS', name: 'Congelados', keywords: ['congelado', 'sorvete', 'massa congelada', 'lasanha', 'nuggets'] },
  { code: 'PET_SHOP', name: 'Pet Shop', keywords: ['pet', 'racao', 'ração', 'cachorro', 'gato', 'areia sanitaria', 'areia sanitária'] },
  { code: 'BEBE', name: 'Bebe', keywords: ['bebe', 'bebê', 'infantil', 'fralda', 'lenço umedecido', 'formula infantil'] },
  { code: 'CHURRASCO', name: 'Churrasco', keywords: ['churrasco', 'espeto', 'carvao', 'assado', 'picanha', 'costela'] },
  { code: 'CARNES_DIA_A_DIA', name: 'Carnes Dia a Dia', keywords: ['acougue', 'açougue', 'bovino', 'suino', 'frango', 'carne', 'peixe', 'linguica'] },
  { code: 'PADARIA', name: 'Padaria', keywords: ['padaria', 'panificacao', 'pao', 'pães', 'bolo', 'confeitaria'] },
  { code: 'CONSUMO_RAPIDO', name: 'Consumo Rapido', keywords: ['pronto', 'lanche', 'snack', 'pizza', 'marmita'] },
  { code: 'GULOSEIMAS', name: 'Guloseimas', keywords: ['chocolate', 'doce', 'bala', 'bombom', 'biscoito', 'guloseima'] },
  { code: 'BEBIDAS', name: 'Bebidas', keywords: ['bebida', 'refrigerante', 'suco', 'agua', 'água', 'energetico', 'energético'] },
  { code: 'VINHOS', name: 'Vinhos', keywords: ['vinho', 'adega', 'espumante', 'whisky', 'gin', 'licor'] },
  { code: 'CERVEJAS', name: 'Cervejas', keywords: ['cerveja', 'lager', 'pilsen', 'ipa', 'long neck', 'chopp'] },
  { code: 'HORTIFRUTI', name: 'Hortifruti', keywords: ['hortifruti', 'fruta', 'verdura', 'legume', 'folhoso'] },
  { code: 'LIMPEZA', name: 'Limpeza', keywords: ['limpeza', 'detergente', 'desinfetante', 'alvejante', 'sabao', 'sabão'] },
  { code: 'HIGIENE_PESSOAL', name: 'Higiene Pessoal', keywords: ['higiene', 'sabonete', 'shampoo', 'desodorante', 'papel higienico', 'papel higiênico'] },
  { code: 'PERFUMARIA', name: 'Perfumaria', keywords: ['perfumaria', 'perfume', 'colonia', 'colônia', 'hidratante', 'maquiagem'] },
]

@Injectable()
export class CategoryHierarchyService {
  private readonly handoffCsvPath = process.env.HANDOFF_CSV_PATH || '/data/handoff_ecommerce_v3_n1_n2.csv'

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Retorna todas as categorias N1 com suas sub-categorias N2
   * Structure: { id, name, children: [{id, name}] }
   */
  async getCategoryHierarchy(activeOnly = true) {
    const where = activeOnly ? { active: true } : {}

    const n1Categories = await this.prisma.category.findMany({
      where: {
        ...where,
        parentId: null // Apenas N1 (sem pai)
      },
      select: {
        id: true,
        name: true,
        priority: true,
        children: {
          where: activeOnly ? { active: true } : {},
          select: {
            id: true,
            name: true,
            priority: true
          },
          orderBy: { priority: 'desc' }
        }
      },
      orderBy: { priority: 'desc' }
    })

    return n1Categories
  }

  /**
   * Retorna sub-categorias (N2) de uma categoria N1
   */
  async getSubcategories(parentCategoryId: string) {
    const subcategories = await this.prisma.category.findMany({
      where: {
        parentId: parentCategoryId,
        active: true
      },
      select: {
        id: true,
        name: true,
        priority: true
      },
      orderBy: { priority: 'desc' }
    })

    return subcategories
  }

  /**
   * Busca categoria por ID com todas as relações
   */
  async getCategoryById(categoryId: string) {
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
      select: {
        id: true,
        name: true,
        parentId: true,
        parent: {
          select: { id: true, name: true }
        },
        children: {
          where: { active: true },
          select: { id: true, name: true, priority: true },
          orderBy: { priority: 'desc' }
        },
        active: true,
        priority: true,
        limit: true
      }
    })

    return category
  }

  /**
   * Lista produtos mapeados para uma categoria (N1 ou N2)
   * Retorna: EANs com mapeamentos diretos
   */
  async getProductsMappedToCategory(categoryId: string, subcategoryId?: string) {
    const where: any = {
      categoryId
    }

    if (subcategoryId) {
      where.subCategoryId = subcategoryId
    }

    const mappings = await this.prisma.productCategoryMapping.findMany({
      where,
      select: {
        id: true,
        ean: true,
        source: true,
        priority: true,
        createdAt: true
      },
      orderBy: { priority: 'desc' },
      take: 100
    })

    return mappings
  }

  /**
   * Busca mapeamento de um produto específico (por EAN)
   */
  async getProductMapping(ean: string) {
    const mapping = await this.prisma.productCategoryMapping.findUnique({
      where: { ean },
      select: {
        id: true,
        ean: true,
        categoryId: true,
        category: {
          select: { id: true, name: true, parentId: true }
        },
        subCategoryId: true,
        subCategory: {
          select: { id: true, name: true }
        },
        source: true,
        priority: true,
        createdAt: true,
        updatedAt: true
      }
    })

    return mapping
  }

  /**
   * Conta produtos pendentes de classificação
   */
  async countPendingMappings() {
    const count = await this.prisma.categoryMappingPending.count({
      where: { status: 'PENDING' }
    })

    return count
  }

  /**
   * Lista produtos pendentes de classificação
   */
  async getPendingMappings(limit = 20, offset = 0) {
    const pending = await this.prisma.categoryMappingPending.findMany({
      where: { status: 'PENDING' },
      select: {
        id: true,
        ean: true,
        productName: true,
        suggestedCategoryN1: true,
        suggestedCategoryN2: true,
        suggestedCategory: {
          select: { id: true, name: true }
        },
        reason: true,
        notes: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset
    })

    return pending
  }

  /**
   * Conta produtos mapeados vs pendentes
   */
  async getMappingStats() {
    const [mappedRows, pendingRows, total] = await Promise.all([
      this.prisma.productCategoryMapping.findMany({ select: { ean: true } }),
      this.prisma.categoryMappingPending.findMany({ where: { status: 'PENDING' }, select: { ean: true } }),
      this.prisma.product.count(),
    ])

    const mappedSet = new Set(mappedRows.map((row) => row.ean))
    const pendingSet = new Set(pendingRows.map((row) => row.ean))
    const coveredSet = new Set([...mappedSet, ...pendingSet])

    const mapped = mappedSet.size
    const pending = pendingSet.size
    const covered = coveredSet.size
    const unmapped = Math.max(0, total - covered)

    return {
      mapped,
      pending,
      total,
      unmapped,
    }
  }

  /**
   * Busca produtos completos mapeados para uma categoria
   * Retorna detalhes do produto (nome, pre�o, estoque, etc)
   */
  async getProductsInCategory(categoryId: string, subcategoryId?: string, limit = 20, offset = 0) {
    // Buscar EANs mapeados
    const where: any = { categoryId }
    if (subcategoryId) {
      where.subCategoryId = subcategoryId
    }

    const mappings = await this.prisma.productCategoryMapping.findMany({
      where,
      select: { ean: true },
      take: limit,
      skip: offset
    })

    const eans = mappings.map(m => m.ean)

    if (eans.length === 0) {
      return []
    }

    // Buscar produtos com esses EANs
    const products = await this.prisma.product.findMany({
      where: {
        ean: { in: eans },
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
        price: true,
        promotionalPrice: true,
        stock: true,
        active: true
      },
      take: limit
    })

    return products
  }
  /**
   * Criar uma nova categoria N1
   */
  async createCategory(name: string, priority = 0) {
    const category = await this.prisma.category.create({
      data: { name, priority, active: true }
    })
    return category
  }

  /**
   * Criar subcategoria N2
   */
  async createSubcategory(parentId: string, name: string, priority = 0) {
    const subcategory = await this.prisma.category.create({
      data: { name, parentId, priority, active: true }
    })
    return subcategory
  }

  /**
   * Editar categoria
   */
  async updateCategory(categoryId: string, data: any) {
    const updated = await this.prisma.category.update({
      where: { id: categoryId },
      data
    })
    return updated
  }

  /**
   * Deletar categoria
   */
  async deleteCategory(categoryId: string, hardDelete = false) {
    if (hardDelete) {
      await this.prisma.category.delete({ where: { id: categoryId } })
      return 'Categoria deletada permanentemente'
    } else {
      await this.prisma.category.update({
        where: { id: categoryId },
        data: { active: false }
      })
      return 'Categoria desativada'
    }
  }

  /**
   * Criar mapeamento EAN -> Categoria
   */
  async createProductCategoryMapping(ean: string, categoryId: string, subcategoryId?: string, priority = 0) {
    const mapping = await this.prisma.productCategoryMapping.create({
      data: {
        ean,
        categoryId,
        subCategoryId: subcategoryId || null,
        source: 'handoff',
        priority
      }
    })
    return mapping
  }

  /**
   * Atualizar mapeamento
   */
  async updateProductCategoryMapping(ean: string, data: any) {
    const updated = await this.prisma.productCategoryMapping.update({
      where: { ean },
      data
    })
    return updated
  }

  /**
   * Deletar mapeamento
   */
  async deleteProductCategoryMapping(ean: string) {
    await this.prisma.productCategoryMapping.delete({ where: { ean } })
    return 'Mapeamento deletado'
  }

  /**
   * Aprovar mapeamento pendente
   */
  async approvePendingMapping(id: string, categoryId: string, subcategoryId?: string, notes?: string) {
    const pending = await this.prisma.categoryMappingPending.findUnique({ where: { id } })
    if (!pending) return 'Pendencia nao encontrada'

    // Criar mapeamento confirmado
    await this.createProductCategoryMapping(pending.ean, categoryId, subcategoryId)

    // Marcar pendencia como aprovada
    await this.prisma.categoryMappingPending.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedAt: new Date(),
        notes
      }
    })

    return 'Mapeamento aprovado'
  }

  /**
   * Rejeitar mapeamento pendente
   */
  async rejectPendingMapping(id: string, notes?: string) {
    await this.prisma.categoryMappingPending.update({
      where: { id },
      data: {
        status: 'REJECTED',
        notes
      }
    })
    return 'Mapeamento rejeitado'
  }

  async validateBatchMappings(
    mappings: Array<{ ean: string; categoryId: string; subcategoryId?: string; priority?: number }>,
  ) {
    const errors: Array<{ index: number; ean: string; error: string }> = []
    const warnings: Array<{ index: number; ean: string; warning: string }> = []

    for (let index = 0; index < mappings.length; index += 1) {
      const item = mappings[index]
      const ean = String(item.ean || '').trim()

      if (!ean) {
        errors.push({ index, ean: '', error: 'EAN vazio' })
        continue
      }

      if (!item.categoryId) {
        errors.push({ index, ean, error: 'categoryId obrigatorio' })
        continue
      }

      const [product, category] = await Promise.all([
        this.prisma.product.findUnique({ where: { ean }, select: { id: true, active: true } }),
        this.prisma.category.findUnique({ where: { id: item.categoryId }, select: { id: true, parentId: true, active: true } }),
      ])

      if (!product) {
        errors.push({ index, ean, error: 'Produto nao encontrado para o EAN informado' })
        continue
      }

      if (!category) {
        errors.push({ index, ean, error: 'Categoria N1 nao encontrada' })
        continue
      }

      if (category.parentId) {
        errors.push({ index, ean, error: 'categoryId deve apontar para categoria N1 (sem parentId)' })
        continue
      }

      if (item.subcategoryId) {
        const subcategory = await this.prisma.category.findUnique({
          where: { id: item.subcategoryId },
          select: { id: true, parentId: true, active: true },
        })

        if (!subcategory) {
          errors.push({ index, ean, error: 'Subcategoria N2 nao encontrada' })
          continue
        }

        if (subcategory.parentId !== item.categoryId) {
          errors.push({ index, ean, error: 'Subcategoria nao pertence a categoria N1 informada' })
          continue
        }
      }

      if (!product.active) {
        warnings.push({ index, ean, warning: 'Produto inativo no cadastro' })
      }
    }

    return {
      valid: errors.length === 0,
      total: mappings.length,
      errors,
      warnings,
    }
  }

  async applyBatchMappingsSafeMode(
    mappings: Array<{ ean: string; categoryId: string; subcategoryId?: string; priority?: number }>,
    dryRun = true,
  ) {
    const validation = await this.validateBatchMappings(mappings)

    if (!validation.valid) {
      return {
        ok: false,
        dryRun,
        applied: 0,
        validation,
      }
    }

    if (dryRun) {
      return {
        ok: true,
        dryRun: true,
        applied: 0,
        validation,
      }
    }

    const applied = await this.prisma.$transaction(async (tx) => {
      let count = 0

      for (const item of mappings) {
        await tx.productCategoryMapping.upsert({
          where: { ean: item.ean },
          update: {
            categoryId: item.categoryId,
            subCategoryId: item.subcategoryId || null,
            priority: item.priority ?? 0,
            source: 'handoff',
          },
          create: {
            ean: item.ean,
            categoryId: item.categoryId,
            subCategoryId: item.subcategoryId || null,
            priority: item.priority ?? 0,
            source: 'handoff',
          },
        })
        count += 1
      }

      return count
    })

    return {
      ok: true,
      dryRun: false,
      applied,
      validation,
    }
  }

  async generateMappingSuggestions(limit = 200, onlyUnmapped = true): Promise<MappingSuggestion[]> {
    const learningIndex = await this.buildLearningIndex()
    const profilesById = new Map(learningIndex.profiles.map((profile) => [profile.categoryId, profile]))

    const mappedEans = onlyUnmapped
      ? await this.prisma.productCategoryMapping.findMany({
          select: { ean: true },
        }).then((rows) => rows.map((row) => row.ean))
      : []

    const products = await this.prisma.product.findMany({
      where: onlyUnmapped
        ? {
            active: true,
            ean: { notIn: mappedEans },
          }
        : { active: true },
      select: {
        ean: true,
        name: true,
        alternativeDescription: true,
        category: true,
        classification01: true,
        classification02: true,
        classification03: true,
        classification04: true,
      },
      take: limit,
    })

    const suggestions: MappingSuggestion[] = []

    for (const product of products) {
      const scored = this.scoreProductAgainstProfiles(product, learningIndex.profiles, learningIndex.tokenCategorySpread)
      if (!scored) continue

      const profile = profilesById.get(scored.categoryId)
      if (!profile) continue

      const source = scored.source
      suggestions.push({
        ean: product.ean,
        productName: product.name,
        categoryId: profile.categoryId,
        categoryName: profile.categoryName,
        source,
        reason: scored.reason,
      })
    }

    return suggestions
  }

  async applySuggestedMappings(limit = 200, dryRun = true) {
    const suggestions = await this.generateMappingSuggestions(limit, true)
    const unique = new Map<string, { ean: string; categoryId: string; categoryName: string }>()

    for (const suggestion of suggestions) {
      if (unique.has(suggestion.ean)) continue
      unique.set(suggestion.ean, {
        ean: suggestion.ean,
        categoryId: suggestion.categoryId,
        categoryName: suggestion.categoryName,
      })
    }

    const mappings = Array.from(unique.values()).map((item) => ({
      ean: item.ean,
      categoryId: item.categoryId,
    }))

    return this.applyBatchMappingsSafeMode(mappings, dryRun)
  }

  private async buildLearningIndex(): Promise<LearningIndex> {
    const categories = await this.prisma.category.findMany({
      where: { active: true },
      select: { id: true, name: true },
    })

    const categoryByName = new Map<string, { id: string; name: string }>()
    for (const category of categories) {
      categoryByName.set(this.normalizeKey(category.name), category)
    }

    const profiles = new Map<string, CategoryLearningProfile>()
    const tokenCategorySpread = new Map<string, number>()

    const feedProfile = (categoryId: string, categoryName: string, textParts: Array<string | null | undefined>, weight: number) => {
      const text = textParts.filter(Boolean).join(' ')
      const tokens = this.extractLearningTokens(text)
      if (tokens.length === 0) return

      const profile = profiles.get(categoryId) || {
        categoryId,
        categoryName,
        tokenCounts: new Map<string, number>(),
        totalWeight: 0,
        exampleCount: 0,
      }

      const uniqueTokens = Array.from(new Set(tokens))
      for (const token of uniqueTokens) {
        profile.tokenCounts.set(token, (profile.tokenCounts.get(token) || 0) + weight)
        tokenCategorySpread.set(token, (tokenCategorySpread.get(token) || 0) + 1)
      }

      profile.totalWeight += uniqueTokens.length * weight
      profile.exampleCount += 1
      profiles.set(categoryId, profile)
    }

    const handoffRows = this.loadHandoffRows()
    for (const row of handoffRows) {
      const category = categoryByName.get(this.normalizeKey(row.categoryN1))
      if (!category) continue

      feedProfile(category.id, category.name, [
        row.productName,
        row.classification,
        row.categoryN1,
        row.categoryN2,
        row.publication,
      ], 1.35)
    }

    const mappings = await this.prisma.productCategoryMapping.findMany({
      select: {
        ean: true,
        categoryId: true,
        subCategoryId: true,
        category: { select: { name: true } },
        subCategory: { select: { name: true } },
      },
    })

    const mappedEans = mappings.map((mapping) => mapping.ean)
    const products = mappedEans.length > 0
      ? await this.prisma.product.findMany({
          where: { ean: { in: mappedEans } },
          select: {
            ean: true,
            name: true,
            alternativeDescription: true,
            category: true,
            classification01: true,
            classification02: true,
            classification03: true,
            classification04: true,
          },
        })
      : []

    const productByEan = new Map(products.map((product) => [product.ean, product]))

    for (const mapping of mappings) {
      const product = productByEan.get(mapping.ean)
      if (!product) continue

      feedProfile(mapping.categoryId, mapping.category.name, [
        product.name,
        product.alternativeDescription,
        product.category,
        product.classification01,
        product.classification02,
        product.classification03,
        product.classification04,
        mapping.subCategory?.name,
      ], 1.0)
    }

    return {
      profiles: Array.from(profiles.values()),
      categoryByName,
      tokenCategorySpread,
    }
  }

  private loadHandoffRows(): HandoffLearningRow[] {
    if (!this.handoffCsvPath || !existsSync(this.handoffCsvPath)) {
      return []
    }

    const fileName = basename(this.handoffCsvPath)
    if (!fileName.toLowerCase().includes('handoff')) {
      return []
    }

    const content = readFileSync(this.handoffCsvPath, 'utf8').replace(/^\uFEFF/, '')
    const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0)
    if (lines.length <= 1) return []

    const headers = this.parseCsvLine(lines[0]).map((value) => this.normalizeKey(value))
    const index = new Map(headers.map((header, position) => [header, position]))

    const getValue = (cells: string[], header: string) => {
      const position = index.get(this.normalizeKey(header))
      if (position === undefined) return ''
      return (cells[position] || '').trim()
    }

    const rows: HandoffLearningRow[] = []
    for (let lineIndex = 1; lineIndex < lines.length; lineIndex += 1) {
      const cells = this.parseCsvLine(lines[lineIndex])
      const categoryN1 = getValue(cells, 'categoria_ecommerce_n1')
      const productName = getValue(cells, 'produto')
      const ean = getValue(cells, 'codigo_ean')
      if (!categoryN1 || !productName || !ean) continue

      rows.push({
        categoryN1,
        categoryN2: getValue(cells, 'categoria_ecommerce_n2'),
        ean,
        productName,
        classification: getValue(cells, 'classificacao_atual'),
        publication: getValue(cells, 'sugestao_publicacao'),
      })
    }

    return rows
  }

  private parseCsvLine(line: string) {
    const cells: string[] = []
    let current = ''
    let insideQuotes = false

    for (let index = 0; index < line.length; index += 1) {
      const character = line[index]
      const nextCharacter = line[index + 1]

      if (character === '"') {
        if (insideQuotes && nextCharacter === '"') {
          current += '"'
          index += 1
        } else {
          insideQuotes = !insideQuotes
        }
        continue
      }

      if (character === ',' && !insideQuotes) {
        cells.push(current)
        current = ''
        continue
      }

      current += character
    }

    cells.push(current)
    return cells.map((cell) => cell.trim())
  }

  private scoreProductAgainstProfiles(
    product: {
      ean: string
      name: string
      alternativeDescription?: string | null
      category?: string | null
      classification01?: string | null
      classification02?: string | null
      classification03?: string | null
      classification04?: string | null
    },
    profiles: CategoryLearningProfile[],
    tokenCategorySpread: Map<string, number>,
  ) {
    if (profiles.length === 0) return null

    const queryTokenWeights = new Map<string, number>()
    const addWeightedTokens = (text?: string | null, weight = 1) => {
      const tokens = this.extractLearningTokens(text || '')
      if (tokens.length === 0) return

      for (const token of new Set(tokens)) {
        queryTokenWeights.set(token, (queryTokenWeights.get(token) || 0) + weight)
      }
    }

    addWeightedTokens(product.name, 3)
    addWeightedTokens(product.alternativeDescription, 1.1)
    addWeightedTokens(product.classification01, 0.7)
    addWeightedTokens(product.classification02, 0.7)
    addWeightedTokens(product.classification03, 0.5)
    addWeightedTokens(product.classification04, 0.5)
    if (product.category && !this.isPlaceholderCategory(product.category)) {
      addWeightedTokens(product.category, 0.8)
    }

    const scoredProfiles = profiles.map((profile) => {
      let score = 0
      const evidence: Array<{ token: string; weight: number }> = []
      for (const [token, queryWeight] of queryTokenWeights.entries()) {
        const tokenWeight = profile.tokenCounts.get(token)
        if (!tokenWeight || profile.totalWeight <= 0) continue

        const categoryCoverage = tokenWeight / profile.totalWeight
        const spread = Math.max(1, tokenCategorySpread.get(token) || 1)
        const specificity = 1 / Math.log2(spread + 1)
        const tokenScore = queryWeight * categoryCoverage * specificity
        if (tokenScore <= 0) continue

        score += tokenScore
        evidence.push({ token, weight: tokenScore })
      }

      evidence.sort((left, right) => right.weight - left.weight)
      return { profile, score, evidence }
    })

    scoredProfiles.sort((left, right) => right.score - left.score)
    const best = scoredProfiles[0]
    const second = scoredProfiles[1]

    if (!best || best.score < 0.012) return null
    if (second && best.score < second.score * 1.12) return null

    const topEvidence = best.evidence.slice(0, 3).map((item) => item.token).join(', ')
    const source: MappingSuggestion['source'] = product.category && !this.isPlaceholderCategory(product.category)
      ? 'product.category'
      : 'mercadological_inference'

    return {
      categoryId: best.profile.categoryId,
      source,
      reason: topEvidence
        ? `Aprendido com ${best.profile.exampleCount} itens parecidos do handoff/catalogo interno; sinais: ${topEvidence}`
        : `Aprendido com ${best.profile.exampleCount} itens parecidos do handoff/catalogo interno`,
    }
  }

  private extractLearningTokens(value: string) {
    return this.normalizeSourceText(value)
      .split(/[^a-z0-9]+/g)
      .map((token) => token.trim())
      .filter((token) => token.length >= 3)
      .filter((token) => !this.learningNoiseTokens.has(token))
  }

  private readonly learningNoiseTokens = new Set([
    'com', 'sem', 'para', 'por', 'dos', 'das', 'e', 'de', 'do', 'da', 'em', 'no', 'na', 'nos', 'nas',
    'un', 'unid', 'unidade', 'und', 'unidades', 'pct', 'pcts', 'cx', 'caixa', 'caixas', 'emb', 'embalagem',
    'embalagens', 'vidro', 'pet', 'lata', 'sachet', 'sache', 'gf', 'kg', 'g', 'gr', 'mg', 'ml', 'l', 'lt',
    'litro', 'litros', 'kgf', 'kit', 'novo', 'premium', 'tradicional', 'especial', 'classico', 'clássico',
    'produto', 'linha', 'tipo', 'modelo', 'original', 'sabor', 'caseiro', 'fino', 'super', 'extra', 'mini',
  ])

  async populateN2FromClassifications(
    dryRun = true,
    minOccurrences = 10,
    limitProducts = 30000,
  ): Promise<PopulateN2Result> {
    const n1Categories = await this.prisma.category.findMany({
      where: { active: true, parentId: null },
      select: { id: true, name: true },
    })

    const n1ByCode = new Map<string, { id: string; name: string }>()
    for (const category of n1Categories) {
      n1ByCode.set(this.normalizeKey(category.name), category)
    }

    const existingCategories = await this.prisma.category.findMany({
      select: { id: true, name: true, parentId: true },
    })
    const existingByName = new Map<string, { id: string; name: string; parentId: string | null }>()
    for (const category of existingCategories) {
      existingByName.set(this.normalizeKey(category.name), category)
    }

    const products = await this.prisma.product.findMany({
      where: { active: true },
      select: {
        category: true,
        classification02: true,
      },
      take: limitProducts,
    })

    const counters = new Map<string, { parentId: string; parentName: string; subLabel: string; frequency: number }>()

    for (const product of products) {
      const n1Code = this.normalizeKey(String(product.category || ''))
      if (!n1Code) continue

      const parent = n1ByCode.get(n1Code)
      if (!parent) continue

      const subLabel = this.extractClassificationLabel(product.classification02)
      if (!subLabel) continue

      const key = `${parent.id}::${this.normalizeKey(subLabel)}`
      const current = counters.get(key)
      if (!current) {
        counters.set(key, {
          parentId: parent.id,
          parentName: parent.name,
          subLabel,
          frequency: 1,
        })
      } else {
        current.frequency += 1
      }
    }

    const sortedCandidates = Array.from(counters.values()).sort((a, b) => b.frequency - a.frequency)
    const approvedCandidates = sortedCandidates.filter((candidate) => candidate.frequency >= minOccurrences)
    const skippedByLowFrequency = sortedCandidates.length - approvedCandidates.length

    const toCreate: Array<{ name: string; parentId: string; parentName: string; frequency: number }> = []
    const plannedNames = new Set<string>()

    for (const candidate of approvedCandidates) {
      const uniqueName = this.buildUniqueN2Name(candidate.subLabel, candidate.parentName, existingByName, plannedNames)
      const normalizedUnique = this.normalizeKey(uniqueName)

      if (existingByName.has(normalizedUnique)) continue
      if (plannedNames.has(normalizedUnique)) continue

      plannedNames.add(normalizedUnique)
      toCreate.push({
        name: uniqueName,
        parentId: candidate.parentId,
        parentName: candidate.parentName,
        frequency: candidate.frequency,
      })
    }

    if (dryRun) {
      return {
        ok: true,
        dryRun: true,
        scannedProducts: products.length,
        detectedCandidates: sortedCandidates.length,
        toCreate: toCreate.length,
        created: 0,
        skippedByLowFrequency,
        samples: toCreate.slice(0, 20).map((item) => ({
          parentName: item.parentName,
          subcategoryName: item.name,
          frequency: item.frequency,
        })),
      }
    }

    let created = 0
    for (const item of toCreate) {
      await this.prisma.category.create({
        data: {
          name: item.name,
          parentId: item.parentId,
          active: true,
          priority: item.frequency,
        },
      })
      created += 1
    }

    return {
      ok: true,
      dryRun: false,
      scannedProducts: products.length,
      detectedCandidates: sortedCandidates.length,
      toCreate: toCreate.length,
      created,
      skippedByLowFrequency,
      samples: toCreate.slice(0, 20).map((item) => ({
        parentName: item.parentName,
        subcategoryName: item.name,
        frequency: item.frequency,
      })),
    }
  }

  async generatePendingForUnmapped(limit = 5000): Promise<PendingGenerationResult> {
    const mappedEans = await this.prisma.productCategoryMapping.findMany({
      select: { ean: true },
    }).then((rows) => rows.map((row) => row.ean))

    const existingPending = await this.prisma.categoryMappingPending.findMany({
      select: { ean: true },
    }).then((rows) => new Set(rows.map((row) => row.ean)))

    const categories = await this.prisma.category.findMany({
      where: { active: true },
      select: { id: true, name: true },
    })
    const categoryByName = new Map<string, { id: string; name: string }>()
    for (const category of categories) {
      categoryByName.set(this.normalizeKey(category.name), category)
    }

    const products = await this.prisma.product.findMany({
      where: {
        active: true,
        ean: { notIn: mappedEans },
      },
      select: {
        ean: true,
        name: true,
        category: true,
        classification01: true,
        classification02: true,
        classification03: true,
        classification04: true,
        alternativeDescription: true,
      },
      take: limit,
    })

    let created = 0
    let skippedExistingPending = 0
    let withSuggestion = 0
    let withoutSuggestion = 0

    for (const product of products) {
      if (existingPending.has(product.ean)) {
        skippedExistingPending += 1
        continue
      }

      const suggestedName = this.resolveSuggestedCategoryName(
        product.category,
        product.classification01,
        product.classification02,
        product.classification03,
        product.classification04,
        product.name,
        product.alternativeDescription,
      )

      const suggestedCategory = suggestedName
        ? categoryByName.get(this.normalizeKey(suggestedName))
        : undefined

      if (suggestedCategory) {
        withSuggestion += 1
      } else {
        withoutSuggestion += 1
      }

      await this.prisma.categoryMappingPending.create({
        data: {
          ean: product.ean,
          productName: product.name,
          suggestedCategoryN1: suggestedCategory?.name || null,
          suggestedCategoryId: suggestedCategory?.id || null,
          reason: suggestedCategory ? 'auto_classify' : 'not_found',
          status: 'PENDING',
          notes: suggestedCategory
            ? `Sugestao automatica baseada em classificacao: ${suggestedCategory.name}`
            : 'Pendencia automatica sem sugestao confiavel de categoria',
        },
      })

      created += 1
    }

    return {
      ok: true,
      scannedProducts: products.length,
      created,
      skippedExistingPending,
      withSuggestion,
      withoutSuggestion,
    }
  }

  async resolvePendingAutomatically(limit = 5000, dryRun = true): Promise<PendingResolutionResult> {
    const pending = await this.prisma.categoryMappingPending.findMany({
      where: { status: 'PENDING' },
      select: {
        id: true,
        ean: true,
        reason: true,
        suggestedCategoryId: true,
        notes: true,
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
    })

    const approveCandidates = pending.filter(
      (item) => Boolean(item.suggestedCategoryId) && !this.shouldAutoRejectPendingByPolicy(item.reason, item.notes),
    )
    const rejectCandidates = pending.filter(
      (item) => !item.suggestedCategoryId || this.shouldAutoRejectPendingByPolicy(item.reason, item.notes),
    )

    if (dryRun) {
      return {
        ok: true,
        dryRun: true,
        scannedPending: pending.length,
        approveCandidates: approveCandidates.length,
        rejectCandidates: rejectCandidates.length,
        approved: 0,
        rejected: 0,
      }
    }

    let approved = 0
    let rejected = 0

    for (const item of approveCandidates) {
      await this.prisma.productCategoryMapping.upsert({
        where: { ean: item.ean },
        update: {
          categoryId: item.suggestedCategoryId as string,
          source: 'auto_classify',
        },
        create: {
          ean: item.ean,
          categoryId: item.suggestedCategoryId as string,
          source: 'auto_classify',
        },
      })

      await this.prisma.categoryMappingPending.update({
        where: { id: item.id },
        data: {
          status: 'APPROVED',
          approvedAt: new Date(),
          notes: 'Auto aprovado por sugestao de categoria',
        },
      })

      approved += 1
    }

    for (const item of rejectCandidates) {
      const policyReason = this.extractHandoffPolicyReason(item.notes)
      await this.prisma.categoryMappingPending.update({
        where: { id: item.id },
        data: {
          status: 'REJECTED',
          notes: policyReason
            ? `Auto rejeitado por regra de negocio do handoff: ${policyReason}`
            : 'Auto rejeitado sem sugestao confiavel de categoria',
        },
      })
      rejected += 1
    }

    return {
      ok: true,
      dryRun: false,
      scannedPending: pending.length,
      approveCandidates: approveCandidates.length,
      rejectCandidates: rejectCandidates.length,
      approved,
      rejected,
    }
  }

  private shouldAutoRejectPendingByPolicy(reason?: string | null, notes?: string | null) {
    return this.hasHandoffPolicyFlag(reason) || this.hasHandoffPolicyFlag(notes)
  }

  private hasHandoffPolicyFlag(value?: string | null) {
    const normalized = this.normalizeSourceText(String(value || ''))
    if (!normalized) return undefined

    return (
      normalized.includes('revisar_nunca') ||
      normalized.includes('nao_publicar_inativo') ||
      normalized.includes('nao_publicar_interno')
    )
  }

  private extractHandoffPolicyReason(reason?: string | null, notes?: string | null) {
    const normalized = this.normalizeSourceText(`${reason || ''} ${notes || ''}`)
    if (!normalized) return undefined

    if (normalized.includes('revisar_nunca')) return 'REVISAR_NUNCA'
    if (normalized.includes('nao_publicar_inativo')) return 'NAO_PUBLICAR_INATIVO'
    if (normalized.includes('nao_publicar_interno')) return 'NAO_PUBLICAR_INTERNO'
    return undefined
  }

  private resolveSuggestedCategoryName(
    category?: string | null,
    classification01?: string | null,
    classification02?: string | null,
    classification03?: string | null,
    classification04?: string | null,
    name?: string | null,
    alternativeDescription?: string | null,
  ) {
    const c1 = this.normalizeSourceText(String(classification01 || ''))
    const c2 = this.normalizeSourceText(String(classification02 || ''))
    const c3 = this.normalizeSourceText(String(classification03 || ''))
    const productName = this.normalizeSourceText(String(name || ''))

    // Regras de alta confiança para evitar distorções conhecidas.
    if (c1.includes('matinais') && c2.includes('leite em po')) {
      return 'Mercearia'
    }

    if (
      c2.includes('frios') &&
      /(lombo|linguica|presunto|salame|bacon)/.test(productName)
    ) {
      return 'Carnes Dia a Dia'
    }

    // Fallback por raiz mercadológica (classification01)
    if (c1.includes('01-mercearia') || c1.includes('02-mercearia')) return 'Mercearia'
    if (c1.includes('03-bebidas')) return 'Bebidas'
    if (c1.includes('04-hplu')) return 'Utilidades'
    if (c1.includes('05-acougue')) return 'Carnes Dia a Dia'
    if (c1.includes('06-pereciveis')) return 'Consumo Rapido'
    if (c1.includes('07-laticinios')) return 'Laticinios'
    if (c1.includes('08-flv')) return 'Hortifruti'

    const normalizedCategory = this.normalizeSourceText(String(category || ''))
    if (normalizedCategory && !this.isPlaceholderCategory(category || undefined)) {
      const byCatalog = CATEGORY_CATALOG.find((item) => this.normalizeKey(item.name) === this.normalizeKey(normalizedCategory))
      if (byCatalog) return byCatalog.name
    }

    const source = this.normalizeSourceText(
      `${classification01 || ''} ${classification02 || ''} ${classification03 || ''} ${classification04 || ''} ${name || ''} ${alternativeDescription || ''}`,
    )

    for (const catalogItem of CATEGORY_CATALOG) {
      if (catalogItem.keywords.some((keyword) => source.includes(this.normalizeSourceText(keyword)))) {
        return catalogItem.name
      }
    }

    return undefined
  }

  private normalizeKey(value: string) {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
  }

  private normalizeSourceText(value: string) {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
  }

  private isPlaceholderCategory(code?: string) {
    if (!code) return true
    const normalized = this.normalizeKey(code)
    return normalized === 'GERAL' || normalized === 'NAO_CLASSIFICADO'
  }

  private extractClassificationLabel(value?: string | null) {
    const raw = String(value || '').trim()
    if (!raw) return ''

    const segments = raw.split('|').map((part) => part.trim()).filter(Boolean)
    const target = segments.length > 0 ? segments[segments.length - 1] : raw
    const noPrefix = target.replace(/^\d+\s*[-:]\s*/, '').trim()
    if (!noPrefix) return ''

    return noPrefix
      .toLowerCase()
      .split(/\s+/)
      .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
      .join(' ')
  }

  private buildUniqueN2Name(
    baseName: string,
    parentName: string,
    existingByName: Map<string, { id: string; name: string; parentId: string | null }>,
    plannedNames: Set<string>,
  ) {
    const baseKey = this.normalizeKey(baseName)
    const parentKey = this.normalizeKey(parentName)

    const variants = [
      baseName,
      `${baseName} - ${parentName}`,
      `${parentName} - ${baseName}`,
      `${baseName} (${parentName})`,
      `${parentName} (${baseName})`,
    ]

    for (const variant of variants) {
      const key = this.normalizeKey(variant)
      if (!key) continue
      if (plannedNames.has(key)) continue
      if (existingByName.has(key)) continue
      return variant
    }

    return `${baseName} ${parentKey.slice(0, 4)}`
  }
}



