import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../common/prisma.service'
import { ProductSearchService } from '../products/product-search.service'
import { DEFAULT_STORE_ID, DEFAULT_TENANT_ID } from '../../common/tenant/tenant.constants'
import { TenantContext } from '../../common/tenant/tenant-context'

type CatalogContext = Partial<Pick<TenantContext, 'tenantId' | 'storeId'>>

type IssueInput = {
  tenantId: string
  storeId?: string | null
  productId?: string | null
  legacyProductId?: string | null
  type: string
  severity: string
  title: string
  detail?: string | null
  impactScore: number
}

@Injectable()
export class CatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly productSearch: ProductSearchService,
  ) {}

  async getQuality(context?: CatalogContext) {
    const tenantId = context?.tenantId || DEFAULT_TENANT_ID
    await this.refreshQualityIssues(context)

    const [totalProducts, openIssues, bySeverity, byType] = await Promise.all([
      this.prisma.productMaster.count({ where: { tenantId, status: 'ACTIVE' } }),
      this.prisma.catalogQualityIssue.count({ where: { tenantId, status: 'OPEN' } }),
      this.prisma.catalogQualityIssue.groupBy({
        by: ['severity'],
        where: { tenantId, status: 'OPEN' },
        _count: { _all: true },
      }),
      this.prisma.catalogQualityIssue.groupBy({
        by: ['type'],
        where: { tenantId, status: 'OPEN' },
        _count: { _all: true },
        orderBy: { _count: { type: 'desc' } },
      }),
    ])

    const qualityScore = totalProducts === 0
      ? 100
      : Math.max(0, Math.round(100 - (openIssues / Math.max(totalProducts, 1)) * 100))

    return {
      tenantId,
      storeId: context?.storeId || DEFAULT_STORE_ID,
      totalProducts,
      openIssues,
      qualityScore,
      bySeverity: bySeverity.map((row) => ({ severity: row.severity, count: row._count._all })),
      byType: byType.map((row) => ({ type: row.type, count: row._count._all })),
    }
  }

  async listIssues(context?: CatalogContext, filters?: { status?: string; type?: string; limit?: number }) {
    const tenantId = context?.tenantId || DEFAULT_TENANT_ID
    await this.refreshQualityIssues(context)

    return this.prisma.catalogQualityIssue.findMany({
      where: {
        tenantId,
        status: filters?.status || 'OPEN',
        ...(filters?.type ? { type: filters.type } : {}),
      },
      orderBy: [{ severity: 'asc' }, { impactScore: 'desc' }, { createdAt: 'asc' }],
      take: Math.max(1, Math.min(filters?.limit || 100, 500)),
      include: {
        product: {
          include: {
            media: true,
            categoryAssignments: { include: { category: true } },
            brand: true,
          },
        },
      },
    })
  }

  async resolveIssue(id: string, userId?: string) {
    const issue = await this.prisma.catalogQualityIssue.findUnique({ where: { id } })
    if (!issue) throw new NotFoundException('Issue de catalogo nao encontrada.')

    return this.prisma.catalogQualityIssue.update({
      where: { id },
      data: {
        status: 'RESOLVED',
        resolvedAt: new Date(),
        resolvedBy: userId || null,
      },
    })
  }

  async refreshQualityIssues(context?: CatalogContext) {
    const tenantId = context?.tenantId || DEFAULT_TENANT_ID
    const storeId = context?.storeId || DEFAULT_STORE_ID

    const masters = await this.prisma.productMaster.findMany({
      where: { tenantId },
      include: {
        media: true,
        categoryAssignments: { include: { category: true } },
      },
    })

    const legacyIds = masters.map((master) => master.legacyProductId).filter((id): id is string => Boolean(id))
    const legacyProducts = legacyIds.length
      ? await this.prisma.product.findMany({
          where: { id: { in: legacyIds } },
          select: {
            id: true,
            storeId: true,
            name: true,
            ean: true,
            price: true,
            promotionalPrice: true,
            stock: true,
            active: true,
            syncOption: true,
            category: true,
            classification01: true,
          },
        })
      : []
    const legacyById = new Map(legacyProducts.map((product) => [product.id, product]))
    const duplicateEans = this.findDuplicateEans(masters)

    const issues: IssueInput[] = []
    for (const master of masters) {
      const legacy = master.legacyProductId ? legacyById.get(master.legacyProductId) : undefined
      const scopedStoreId = legacy?.storeId || storeId
      const activeLegacy = legacy?.active !== false && String(legacy?.syncOption || '').toUpperCase() !== 'NUNCA'
      const impactScore = this.issueImpactScore(legacy)
      const categoryText = [
        master.legacyCategory,
        ...master.categoryAssignments.map((assignment) => assignment.category.name),
      ].join(' ')

      if (!master.media.some((media) => media.type === 'IMAGE' && media.status === 'ACTIVE')) {
        issues.push(this.issue(master, scopedStoreId, 'MISSING_IMAGE', 'WARN', 'Produto sem imagem', 'Produto nao possui imagem ativa no catalogo canonico.', impactScore))
      }

      if (master.categoryAssignments.length === 0 && this.isPlaceholderCategory(master.legacyCategory)) {
        issues.push(this.issue(master, scopedStoreId, 'MISSING_CATEGORY', 'WARN', 'Produto sem categoria confiavel', 'Produto nao possui categoria canonica ativa nem categoria legada util.', impactScore))
      }

      if (master.isWeighted && (!this.decimalGreaterThanZero(master.minWeight) || !this.decimalGreaterThanZero(master.weightStep))) {
        issues.push(this.issue(master, scopedStoreId, 'WEIGHT_RULE_MISSING', 'BLOCKER', 'Produto pesavel sem regra de peso', 'Produto pesavel precisa de minWeight e weightStep positivos.', impactScore + 30))
      }

      if (activeLegacy && Number(legacy?.price || 0) <= 0) {
        issues.push(this.issue(master, scopedStoreId, 'ZERO_PRICE', 'BLOCKER', 'Produto publicado sem preco valido', 'Preco legado esta zerado ou invalido.', impactScore + 30))
      }

      if (activeLegacy && legacy?.stock != null && Number(legacy.stock) < 0) {
        issues.push(this.issue(master, scopedStoreId, 'NEGATIVE_STOCK', 'BLOCKER', 'Produto publicado com estoque negativo', 'Estoque negativo deve ser estado interno auditavel, nao disponibilidade positiva.', impactScore + 25))
      }

      if (this.isBadProductName(master.name)) {
        issues.push(this.issue(master, scopedStoreId, 'BAD_NAME', 'WARN', 'Nome de produto ruim ou generico', 'Nome curto, generico ou sem informacao comercial suficiente.', impactScore))
      }

      if (master.ean && duplicateEans.has(`${master.tenantId}:${master.ean}`)) {
        issues.push(this.issue(master, scopedStoreId, 'DUPLICATE_EAN', 'BLOCKER', 'EAN duplicado no catalogo canonico', `EAN ${master.ean} aparece em mais de um ProductMaster.`, impactScore + 40))
      }

      if (this.isFlvProduct(legacy?.classification01) && !this.isCompatibleFlvCategory(categoryText)) {
        issues.push(this.issue(master, scopedStoreId, 'INCOMPATIBLE_CATEGORY', 'WARN', 'FLV em categoria incompatível', 'Produto classificado como FLV precisa estar em categoria compativel ou ter excecao aprovada.', impactScore + 15))
      }
    }

    await this.prisma.catalogQualityIssue.deleteMany({
      where: { tenantId, status: 'OPEN', source: 'AUTO' },
    })

    if (issues.length > 0) {
      await this.prisma.catalogQualityIssue.createMany({ data: issues })
    }

    return { generated: issues.length }
  }

  async rebuildCategoryTree(context?: CatalogContext) {
    const tenantId = context?.tenantId || DEFAULT_TENANT_ID
    const categories = await this.prisma.category.findMany({
      where: { tenantId },
      orderBy: [{ parentId: 'asc' }, { priority: 'asc' }, { name: 'asc' }],
    })

    const createdOrUpdated: string[] = []
    const roots = categories.filter((category) => !category.parentId)
    const children = categories.filter((category) => category.parentId)

    for (const category of roots) {
      const node = await this.upsertCategoryNode(category, null, 1)
      createdOrUpdated.push(node.id)
    }

    for (const category of children) {
      const parent = category.parentId
        ? await this.prisma.categoryNode.findUnique({ where: { legacyCategoryId: category.parentId } })
        : null
      const node = await this.upsertCategoryNode(category, parent?.id || null, parent ? parent.level + 1 : 1)
      createdOrUpdated.push(node.id)
    }

    return {
      tenantId,
      totalSourceCategories: categories.length,
      nodesUpserted: createdOrUpdated.length,
    }
  }

  async reindexSearch() {
    const [legacyResult, productMasters] = await Promise.all([
      this.productSearch.reindexAll(),
      this.prisma.productMaster.count(),
    ])

    return {
      legacyProducts: legacyResult,
      productMasters,
    }
  }

  private async upsertCategoryNode(category: any, parentId: string | null, level: number) {
    return this.prisma.categoryNode.upsert({
      where: { legacyCategoryId: category.id },
      create: {
        id: `cn_${category.id}`,
        tenantId: category.tenantId || DEFAULT_TENANT_ID,
        parentId,
        name: category.name,
        slug: this.slugify(category.name),
        level,
        status: category.active === false ? 'INACTIVE' : 'ACTIVE',
        sortOrder: category.priority || 0,
        legacyCategoryId: category.id,
      },
      update: {
        tenantId: category.tenantId || DEFAULT_TENANT_ID,
        parentId,
        name: category.name,
        slug: this.slugify(category.name),
        level,
        status: category.active === false ? 'INACTIVE' : 'ACTIVE',
        sortOrder: category.priority || 0,
      },
    })
  }

  private issue(master: any, storeId: string | null, type: string, severity: string, title: string, detail: string, impactScore: number): IssueInput {
    return {
      tenantId: master.tenantId,
      storeId,
      productId: master.id,
      legacyProductId: master.legacyProductId,
      type,
      severity,
      title,
      detail,
      impactScore,
    }
  }

  private issueImpactScore(legacy?: { active?: boolean | null; stock?: number | null; promotionalPrice?: number | null }) {
    if (!legacy) return 10
    let score = legacy.active === false ? 5 : 30
    if (Number(legacy.stock || 0) > 0) score += 25
    if (legacy.promotionalPrice != null) score += 10
    return score
  }

  private findDuplicateEans(masters: Array<{ tenantId: string; ean?: string | null }>) {
    const counts = new Map<string, number>()
    for (const master of masters) {
      const ean = String(master.ean || '').trim()
      if (!ean) continue
      const key = `${master.tenantId}:${ean}`
      counts.set(key, (counts.get(key) || 0) + 1)
    }

    return new Set(Array.from(counts.entries()).filter(([, count]) => count > 1).map(([key]) => key))
  }

  private decimalGreaterThanZero(value: unknown) {
    return Number(value || 0) > 0
  }

  private isPlaceholderCategory(category?: string | null) {
    const normalized = String(category || '').trim().toUpperCase()
    return !normalized || ['GERAL', 'NAO_CLASSIFICADO', 'NÃO CLASSIFICADO', 'SEM CATEGORIA'].includes(normalized)
  }

  private isBadProductName(name: string) {
    const normalized = String(name || '').trim().toLowerCase()
    if (normalized.length < 4) return true
    if (/^\d+$/.test(normalized)) return true
    return ['produto', 'item', 'diversos', 'mercadoria', 'sem nome'].includes(normalized)
  }

  private isFlvProduct(classification01?: string | null) {
    const normalized = String(classification01 || '').toLowerCase()
    return normalized.includes('flv') || normalized.includes('hort')
  }

  private isCompatibleFlvCategory(categoryText: string) {
    const normalized = categoryText.toLowerCase()
    return ['hort', 'frut', 'verd', 'legum', 'flv', 'mercearia'].some((term) => normalized.includes(term))
  }

  private slugify(value: string) {
    const slug = String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')

    return slug || 'categoria'
  }
}
