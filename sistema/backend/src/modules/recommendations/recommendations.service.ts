import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../../common/prisma.service'
import { DEFAULT_STORE_ID, DEFAULT_TENANT_ID } from '../../common/tenant/tenant.constants'
import { TenantContext } from '../../common/tenant/tenant-context'

type RecommendationContext = Partial<Pick<TenantContext, 'tenantId' | 'storeId'>>

type ProductRow = {
  id: string
  ean: string
  name: string
  titleMask?: string | null
  titleMaskShort?: string | null
  price: number
  promotionalPrice?: number | null
  stock?: number | null
  syncOption?: string | null
  category?: string | null
  classification01?: string | null
  classification02?: string | null
  classification03?: string | null
  classification04?: string | null
  unit?: string | null
  badges?: string | null
  isFractional?: boolean
  fractionStep?: number | null
  active: boolean
}

@Injectable()
export class RecommendationsService {
  constructor(private readonly prisma: PrismaService) {}

  async getRebuy(customerId: string, context?: RecommendationContext, limit = 12) {
    const { tenantId, storeId } = this.resolveContext(context)
    const id = String(customerId || '').trim()
    if (!id) throw new BadRequestException('customerId e obrigatorio.')

    const items = await this.prisma.orderItem.findMany({
      where: {
        tenantId,
        storeId,
        order: {
          customerId: id,
          status: { notIn: ['CANCELLED', 'FAILED_SYNC', 'REFUNDED'] },
        },
      },
      select: { productId: true, quantity: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 1000,
    })

    const ranked = new Map<string, { score: number; lastSeen: number; quantity: number }>()
    for (const item of items) {
      const current = ranked.get(item.productId) || { score: 0, lastSeen: 0, quantity: 0 }
      current.quantity += Number(item.quantity || 0)
      current.score += 10 + Math.max(0, 30 - Math.floor((Date.now() - item.createdAt.getTime()) / 86_400_000))
      current.lastSeen = Math.max(current.lastSeen, item.createdAt.getTime())
      ranked.set(item.productId, current)
    }

    const products = await this.availableProducts([...ranked.keys()], { tenantId, storeId })
    return {
      context: 'REBUY',
      customerId: id,
      items: this.rankProducts(products, ranked, limit, 'historico_de_compra'),
    }
  }

  async getComplementary(productId: string, context?: RecommendationContext, limit = 12) {
    const { tenantId, storeId } = this.resolveContext(context)
    const baseId = String(productId || '').trim()
    if (!baseId) throw new BadRequestException('productId e obrigatorio.')

    const ordersWithProduct = await this.prisma.orderItem.findMany({
      where: { tenantId, storeId, productId: baseId, order: { status: { notIn: ['CANCELLED', 'FAILED_SYNC', 'REFUNDED'] } } },
      select: { orderId: true },
      orderBy: { createdAt: 'desc' },
      take: 500,
    })
    const orderIds = Array.from(new Set(ordersWithProduct.map((item) => item.orderId)))
    if (orderIds.length === 0) return this.getPopularFallback({ tenantId, storeId }, baseId, limit, 'COMPLEMENTARY')

    const coItems = await this.prisma.orderItem.findMany({
      where: { tenantId, storeId, orderId: { in: orderIds }, productId: { not: baseId } },
      select: { productId: true, quantity: true },
      take: 5000,
    })
    const ranked = new Map<string, { score: number; quantity: number }>()
    for (const item of coItems) {
      const current = ranked.get(item.productId) || { score: 0, quantity: 0 }
      current.score += 1
      current.quantity += Number(item.quantity || 0)
      ranked.set(item.productId, current)
    }

    if (ranked.size === 0) return this.getPopularFallback({ tenantId, storeId }, baseId, limit, 'COMPLEMENTARY')
    const products = await this.availableProducts([...ranked.keys()], { tenantId, storeId })
    return {
      context: 'COMPLEMENTARY',
      productId: baseId,
      items: this.rankProducts(products, ranked, limit, 'comprados_juntos'),
    }
  }

  async getSubstitutes(productId: string, context?: RecommendationContext, limit = 8) {
    const { tenantId, storeId } = this.resolveContext(context)
    const product = await this.requireProduct(productId, { tenantId, storeId })
    const master = await this.prisma.productMaster.findFirst({
      where: { tenantId, legacyProductId: product.id },
      select: { id: true },
    })
    if (!master) return { context: 'SUBSTITUTE', productId: product.id, items: [] }

    const links = await this.prisma.productSubstitution.findMany({
      where: { productId: master.id, status: 'ACTIVE' },
      include: { substitute: true },
      orderBy: { priority: 'asc' },
      take: 30,
    })
    const ranked = new Map<string, { score: number; priority: number }>()
    const legacyIds: string[] = []
    for (const link of links) {
      const legacyProductId = link.substitute.legacyProductId
      if (!legacyProductId) continue
      legacyIds.push(legacyProductId)
      ranked.set(legacyProductId, { score: Math.max(1, 100 - link.priority), priority: link.priority })
    }

    const products = (await this.availableProducts(legacyIds, { tenantId, storeId }))
      .filter((candidate) => this.isCompatibleSubstitute(product, candidate))

    return {
      context: 'SUBSTITUTE',
      productId: product.id,
      items: this.rankProducts(products, ranked, limit, 'substituto_catalogo'),
    }
  }

  async getShowcase(filters: RecommendationContext & { segmentKey?: string; limit?: number } = {}) {
    const { tenantId, storeId } = this.resolveContext(filters)
    const limit = this.safeLimit(filters.limit, 12)
    let customerIds: string[] = []
    if (filters.segmentKey) {
      const segment = await this.prisma.customerSegment.findFirst({
        where: { tenantId, key: String(filters.segmentKey).trim(), status: 'ACTIVE' },
        include: { members: true },
      })
      customerIds = segment?.members.map((member) => member.customerId) || []
    }

    const orderItems = await this.prisma.orderItem.findMany({
      where: {
        tenantId,
        storeId,
        order: {
          status: { notIn: ['CANCELLED', 'FAILED_SYNC', 'REFUNDED'] },
          ...(customerIds.length > 0 ? { customerId: { in: customerIds } } : {}),
        },
      },
      select: { productId: true, quantity: true, subtotal: true },
      take: 10000,
    })

    const ranked = new Map<string, { score: number; quantity: number; revenue: number }>()
    for (const item of orderItems) {
      const current = ranked.get(item.productId) || { score: 0, quantity: 0, revenue: 0 }
      current.quantity += Number(item.quantity || 0)
      current.revenue += Number(item.subtotal || 0)
      current.score += Number(item.quantity || 0) + Number(item.subtotal || 0) / 100
      ranked.set(item.productId, current)
    }

    const products = await this.availableProducts([...ranked.keys()], { tenantId, storeId })
    const withMargin = await this.attachMarginScore(products, ranked, { tenantId, storeId })
    return {
      context: 'SEGMENT_SHOWCASE',
      segmentKey: filters.segmentKey || null,
      items: this.rankProducts(withMargin, ranked, limit, 'segmento_margem_disponibilidade'),
    }
  }

  async recordEvent(body: any, context?: RecommendationContext) {
    const { tenantId, storeId } = this.resolveContext({ ...context, storeId: body?.storeId || context?.storeId })
    const eventType = this.normalizeCode(body?.eventType || 'IMPRESSION')
    const recommendedProductId = String(body?.recommendedProductId || '').trim()
    if (!recommendedProductId) throw new BadRequestException('recommendedProductId e obrigatorio.')

    const event = await this.prisma.recommendationEvent.create({
      data: {
        tenantId,
        storeId,
        customerId: this.optionalString(body.customerId),
        sessionId: this.optionalString(body.sessionId),
        deviceId: this.optionalString(body.deviceId),
        context: this.normalizeCode(body.context || 'UNKNOWN'),
        source: this.normalizeCode(body.source || 'RULES'),
        eventType,
        productId: this.optionalString(body.productId),
        recommendedProductId,
        reason: this.optionalString(body.reason),
        score: this.decimal(Number(body.score || 0)),
        orderId: this.optionalString(body.orderId),
        cartId: this.optionalString(body.cartId),
        metadata: body.metadata || undefined,
        convertedAt: ['ADD_TO_CART', 'PURCHASE'].includes(eventType) ? new Date() : null,
      },
    })

    await this.prisma.analyticsEvent.create({
      data: {
        tenantId,
        storeId,
        type: `RECOMMENDATION_${eventType}`,
        entity: 'PRODUCT',
        entityId: recommendedProductId,
        customerId: event.customerId,
        sessionId: event.sessionId,
        deviceId: event.deviceId,
        metadata: JSON.stringify({ context: event.context, source: event.source, productId: event.productId, orderId: event.orderId, cartId: event.cartId }),
      },
    })

    return event
  }

  async getOperationalInsights(context?: RecommendationContext) {
    const { tenantId, storeId } = this.resolveContext(context)
    const [products, recentItems, substitutions, recEvents] = await Promise.all([
      this.prisma.product.findMany({
        where: { tenantId, storeId, active: true },
        select: this.productSelect(),
        take: 5000,
      }),
      this.prisma.orderItem.findMany({
        where: {
          tenantId,
          storeId,
          createdAt: { gte: new Date(Date.now() - 14 * 86_400_000) },
          order: { status: { notIn: ['CANCELLED', 'FAILED_SYNC', 'REFUNDED'] } },
        },
        select: { productId: true, quantity: true },
        take: 20000,
      }),
      this.prisma.orderEvent.findMany({
        where: { tenantId, storeId, type: { in: ['order.substitution_accepted', 'order.item_missing'] }, createdAt: { gte: new Date(Date.now() - 30 * 86_400_000) } },
        select: { type: true, payload: true },
        take: 5000,
      }),
      this.prisma.recommendationEvent.groupBy({
        by: ['eventType'],
        where: { tenantId, storeId },
        _count: { _all: true },
      }),
    ])

    const dailyDemand = new Map<string, number>()
    for (const item of recentItems) {
      dailyDemand.set(item.productId, (dailyDemand.get(item.productId) || 0) + Number(item.quantity || 0) / 14)
    }

    const stockoutForecast = products
      .map((product) => {
        const demand = dailyDemand.get(product.id) || 0
        const stock = Number(product.stock || 0)
        const daysToStockout = demand > 0 ? stock / demand : null
        return { productId: product.id, name: this.displayName(product), stock, dailyDemand: Number(demand.toFixed(3)), daysToStockout }
      })
      .filter((item) => item.daysToStockout !== null && item.daysToStockout <= 3)
      .sort((a, b) => Number(a.daysToStockout) - Number(b.daysToStockout))
      .slice(0, 20)

    const criticalProducts = products
      .filter((product) => this.isAvailable(product) && Number(product.stock || 0) <= 3)
      .map((product) => ({ productId: product.id, name: this.displayName(product), stock: Number(product.stock || 0), reason: 'estoque_critico' }))
      .slice(0, 20)

    const stuckCampaignSuggestions = products
      .filter((product) => this.isAvailable(product) && !dailyDemand.has(product.id) && Number(product.stock || 0) >= 10)
      .map((product) => ({ productId: product.id, name: this.displayName(product), stock: Number(product.stock || 0), suggestion: 'campanha_item_parado' }))
      .slice(0, 20)

    const accepted = substitutions.filter((event) => event.type === 'order.substitution_accepted').length
    const requested = substitutions.length
    const recCounts = Object.fromEntries(recEvents.map((event) => [event.eventType, event._count._all]))
    const conversions = Number(recCounts.ADD_TO_CART || 0) + Number(recCounts.PURCHASE || 0)
    const impressions = Number(recCounts.IMPRESSION || 0)

    return {
      stockoutForecast,
      criticalProducts,
      stuckCampaignSuggestions,
      substituteAcceptance: {
        requested,
        accepted,
        rate: requested > 0 ? Number(((accepted / requested) * 100).toFixed(2)) : 0,
        suggestion: accepted > 0 ? 'priorizar_substitutos_com_aceitacao' : 'coletar_mais_sinais',
      },
      recommendationConversion: {
        impressions,
        clicks: Number(recCounts.CLICK || 0),
        addToCart: Number(recCounts.ADD_TO_CART || 0),
        purchases: Number(recCounts.PURCHASE || 0),
        conversionRate: impressions > 0 ? Number(((conversions / impressions) * 100).toFixed(2)) : 0,
      },
    }
  }

  private async getPopularFallback(context: { tenantId: string; storeId: string }, excludeProductId: string, limit: number, recContext: string) {
    const rows = await this.prisma.orderItem.groupBy({
      by: ['productId'],
      where: { tenantId: context.tenantId, storeId: context.storeId, productId: { not: excludeProductId } },
      _count: { _all: true },
      orderBy: { _count: { productId: 'desc' } },
      take: limit * 3,
    })
    const ranked = new Map(rows.map((row) => [row.productId, { score: row._count._all }]))
    const products = await this.availableProducts(rows.map((row) => row.productId), context)
    return {
      context: recContext,
      productId: excludeProductId,
      items: this.rankProducts(products, ranked, limit, 'popularidade'),
    }
  }

  private async availableProducts(productIds: string[], context: { tenantId: string; storeId: string }) {
    const ids = Array.from(new Set(productIds.filter(Boolean)))
    if (ids.length === 0) return []
    const products = await this.prisma.product.findMany({
      where: { id: { in: ids }, tenantId: context.tenantId, storeId: context.storeId },
      select: this.productSelect(),
    })
    return products.filter((product) => this.isAvailable(product))
  }

  private async requireProduct(productId: string, context: { tenantId: string; storeId: string }) {
    const id = String(productId || '').trim()
    if (!id) throw new BadRequestException('productId e obrigatorio.')
    const product = await this.prisma.product.findFirst({
      where: { id, tenantId: context.tenantId, storeId: context.storeId },
      select: this.productSelect(),
    })
    if (!product) throw new NotFoundException('Produto nao encontrado.')
    return product
  }

  private async attachMarginScore(products: ProductRow[], ranked: Map<string, any>, context: { tenantId: string; storeId: string }) {
    const priceItems = await this.prisma.priceListItem.findMany({
      where: {
        productId: { in: products.map((product) => product.id) },
        priceList: {
          tenantId: context.tenantId,
          OR: [{ storeId: context.storeId }, { storeId: null }],
          status: 'ACTIVE',
        },
      },
      select: { productId: true, margin: true },
    })
    const marginByProduct = new Map(priceItems.map((item) => [item.productId, Number(item.margin || 0)]))
    for (const product of products) {
      const current = ranked.get(product.id) || { score: 0 }
      current.score += Math.max(0, marginByProduct.get(product.id) || 0) / 10
      current.margin = marginByProduct.get(product.id) || null
      ranked.set(product.id, current)
    }
    return products
  }

  private rankProducts(products: ProductRow[], ranked: Map<string, any>, limit: number, reason: string) {
    return products
      .map((product) => {
        const rank = ranked.get(product.id) || { score: 0 }
        return {
          product: this.toCustomerFacingProduct(product),
          score: Number(Number(rank.score || 0).toFixed(3)),
          reason,
          margin: rank.margin ?? null,
          availableStock: Number(product.stock || 0),
        }
      })
      .sort((a, b) => b.score - a.score || b.availableStock - a.availableStock)
      .slice(0, this.safeLimit(limit, 12))
  }

  private isCompatibleSubstitute(source: ProductRow, candidate: ProductRow) {
    const sameCategory = source.category && candidate.category && source.category === candidate.category
    const sameClassification = source.classification01 && candidate.classification01 && source.classification01 === candidate.classification01
    if (!sameCategory && !sameClassification) return false
    const sourcePrice = Number(source.promotionalPrice || source.price || 0)
    const candidatePrice = Number(candidate.promotionalPrice || candidate.price || 0)
    if (sourcePrice <= 0 || candidatePrice <= 0) return true
    return candidatePrice >= sourcePrice * 0.6 && candidatePrice <= sourcePrice * 1.4
  }

  private isAvailable(product: Pick<ProductRow, 'active' | 'syncOption' | 'stock'>) {
    if (!product.active) return false
    const syncOption = String(product.syncOption || 'ESTOQUE').toUpperCase()
    if (syncOption === 'NUNCA') return false
    if (syncOption === 'SEMPRE') return true
    return Number(product.stock || 0) > 0
  }

  private productSelect() {
    return {
      id: true,
      ean: true,
      name: true,
      titleMask: true,
      titleMaskShort: true,
      price: true,
      promotionalPrice: true,
      stock: true,
      syncOption: true,
      category: true,
      classification01: true,
      classification02: true,
      classification03: true,
      classification04: true,
      unit: true,
      badges: true,
      isFractional: true,
      fractionStep: true,
      active: true,
    } satisfies Prisma.ProductSelect
  }

  private toCustomerFacingProduct<T extends ProductRow>(product: T) {
    return {
      ...product,
      name: this.displayName(product),
    }
  }

  private displayName(product: Pick<ProductRow, 'name' | 'titleMask' | 'titleMaskShort'>) {
    return String(product.titleMask || '').trim() || String(product.titleMaskShort || '').trim() || product.name
  }

  private resolveContext(context?: RecommendationContext) {
    return {
      tenantId: context?.tenantId || DEFAULT_TENANT_ID,
      storeId: context?.storeId || DEFAULT_STORE_ID,
    }
  }

  private safeLimit(value?: number, fallback = 12) {
    return Math.max(1, Math.min(50, Number(value || fallback)))
  }

  private optionalString(value?: string | null) {
    const normalized = String(value || '').trim()
    return normalized || null
  }

  private normalizeCode(value: string) {
    return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9_]+/g, '_') || 'UNKNOWN'
  }

  private decimal(value: number) {
    return new Prisma.Decimal(Number.isFinite(value) ? value.toFixed(3) : '0')
  }
}
