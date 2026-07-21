import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  private buildMappedClassificationSets(mappings: Array<{ classificationLevel: number; classificationValue: string }>) {
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

    return { level1, level2, level3, level4 }
  }

  private matchesMappedClassification(
    product: {
      classification01?: string | null
      classification02?: string | null
      classification03?: string | null
      classification04?: string | null
    },
    mapped: { level1: Set<string>; level2: Set<string>; level3: Set<string>; level4: Set<string> }
  ) {
    if (mapped.level1.size > 0 && product.classification01 && mapped.level1.has(product.classification01)) return true
    if (mapped.level2.size > 0 && product.classification02 && mapped.level2.has(product.classification02)) return true
    if (mapped.level3.size > 0 && product.classification03 && mapped.level3.has(product.classification03)) return true
    if (mapped.level4.size > 0 && product.classification04 && mapped.level4.has(product.classification04)) return true
    return false
  }

  private isStorefrontVisible(product: { active: boolean; syncOption?: string | null; stock?: number | null }) {
    if (!product.active) return false;
    if (product.syncOption === 'NUNCA') return false;
    if (product.syncOption === 'ESTOQUE' || product.syncOption === 'ESTQOUE') return Number(product.stock || 0) > 0;
    return true;
  }

  async getTopSellingProducts(limit = 8) {
    const safeLimit = Math.max(1, Math.min(20, limit));

    const mappings = await this.prisma.categoryClassificationMapping.findMany({
      select: {
        classificationLevel: true,
        classificationValue: true,
      },
    });

    // Regra global do storefront: sem mapeamentos, nada é exibido.
    if (mappings.length === 0) {
      return { data: [] };
    }

    const mappedSets = this.buildMappedClassificationSets(mappings)

    const rows = await this.prisma.orderItem.findMany({
      where: {
        order: {
          status: {
            not: 'CANCELLED',
          },
        },
      },
      select: {
        productId: true,
        quantity: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 20000,
    });

    const qtyByProduct = new Map<string, number>();
    for (const row of rows) {
      qtyByProduct.set(row.productId, (qtyByProduct.get(row.productId) || 0) + Number(row.quantity || 0));
    }

    const sortedProductIds = [...qtyByProduct.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([productId]) => productId);

    if (sortedProductIds.length === 0) {
      return { data: [] };
    }

    const products = await this.prisma.product.findMany({
      where: {
        id: { in: sortedProductIds },
      },
      select: {
        id: true,
        ean: true,
        name: true,
        alternativeDescription: true,
        classification01: true,
        classification02: true,
        classification03: true,
        classification04: true,
        price: true,
        promotionalPrice: true,
        stock: true,
        isFractional: true,
        fractionStep: true,
        unit: true,
        badges: true,
        titleMask: true,
        titleMaskShort: true,
        syncOption: true,
        category: true,
        origin: true,
        active: true,
      },
    });

    const productMap = new Map(products.map((product) => [product.id, product]));

    const data = sortedProductIds
      .map((id) => {
        const product = productMap.get(id);
        if (!product) return null;
        if (!this.isStorefrontVisible(product)) return null;
        if (!this.matchesMappedClassification(product, mappedSets)) return null;
        return {
          product,
          soldQuantity: Number((qtyByProduct.get(id) || 0).toFixed(3)),
        };
      })
      .filter((item): item is { product: (typeof products)[number]; soldQuantity: number } => Boolean(item))
      .slice(0, safeLimit);

    return { data };
  }

  async trackEvent(data: {
    tenantId?: string;
    storeId?: string;
    type: string;
    entity?: string;
    entityId?: string;
    channel?: string;
    source?: string;
    sessionId?: string;
    customerId?: string;
    deviceId?: string;
    metadata?: Record<string, unknown>;
  }) {
    return this.prisma.analyticsEvent.create({
      data: {
        tenantId: data.tenantId || 'tenant_default',
        storeId: data.storeId || 'store_default',
        type: data.type,
        entity: data.entity,
        entityId: data.entityId,
        channel: data.channel || 'STOREFRONT',
        source: data.source,
        sessionId: data.sessionId,
        customerId: data.customerId,
        deviceId: data.deviceId,
        metadata: data.metadata ? JSON.stringify(data.metadata) : null,
      },
    });
  }

  async getTopInterest() {
    return this.prisma.analyticsEvent.groupBy({
      by: ['entityId'],
      where: { type: 'VIEW_PRODUCT', entity: 'PRODUCT' },
      _count: {
        _all: true,
      },
      orderBy: {
        _count: {
          entityId: 'desc',
        },
      },
      take: 10,
    });
  }

  async getBiInsights() {
    // 1. Top Eventos Gerais
    const events = await this.prisma.analyticsEvent.groupBy({
      by: ['type'],
      _count: { _all: true },
    });

    // 2. Funil de Conversão (Resumo)
    const viewCount = await this.prisma.analyticsEvent.count({ where: { type: 'VIEW_CATEGORY' } });
    const cartCount = await this.prisma.analyticsEvent.count({ where: { type: 'ADD_TO_CART' } });
    const checkoutCount = await this.prisma.analyticsEvent.count({ where: { type: 'INITIATE_CHECKOUT' } });

    // 3. Produtos "Mais Desejados" (Top Add to Cart)
    const topCart = await this.prisma.analyticsEvent.groupBy({
      by: ['entityId'],
      where: { type: 'ADD_TO_CART' },
      _count: { _all: true },
      orderBy: { _count: { entityId: 'desc' } },
      take: 5,
    });

    const productIds = topCart.map(i => i.entityId).filter(Boolean) as string[];
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true }
    });

    const detailedTopCart = topCart.map(item => {
      const p = products.find(prod => prod.id === item.entityId);
      return {
        name: p?.name || 'Desconhecido',
        count: item._count._all
      };
    });

    return {
      overview: events,
      funnel: {
        views: viewCount,
        carts: cartCount,
        checkouts: checkoutCount,
        conversion: viewCount > 0 ? ((checkoutCount / viewCount) * 100).toFixed(2) + '%' : '0%'
      },
      topWished: detailedTopCart
    };
  }

  async getFunnel() {
    const views = await this.prisma.analyticsEvent.count({ where: { type: 'VIEW_PRODUCT' } })
    const addedToCart = await this.prisma.analyticsEvent.count({ where: { type: 'ADD_TO_CART' } })
    const checkoutStarted = await this.prisma.analyticsEvent.count({ where: { type: 'INITIATE_CHECKOUT' } })
    const purchased = await this.prisma.order.count({ where: { status: 'COMPLETED' } })

    return {
      views,
      addedToCart,
      checkoutStarted,
      purchased,
    }
  }

  async listEvents(limit = 1000) {
    const safeLimit = Math.max(1, Math.min(10000, limit))
    const data = await this.prisma.analyticsEvent.findMany({
      orderBy: { createdAt: 'desc' },
      take: safeLimit,
    })
    return { data }
  }

  async getSearchInsights(days = 14, limit = 10) {
    const safeDays = Math.max(1, Math.min(90, days))
    const safeLimit = Math.max(1, Math.min(30, limit))
    const from = new Date()
    from.setDate(from.getDate() - safeDays)

    const events = await this.prisma.analyticsEvent.findMany({
      where: {
        type: 'SEARCH',
        createdAt: { gte: from },
      },
      select: {
        metadata: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 5000,
    })

    const searchAddToCartEvents = await this.prisma.analyticsEvent.findMany({
      where: {
        type: 'ADD_TO_CART',
        createdAt: { gte: from },
      },
      select: {
        metadata: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 5000,
    })

    const terms = new Map<string, { count: number; noResults: number; suggestionUsage: number; correctedCount: number; lastAt: string }>()
    const corrections = new Map<string, { count: number; lastAt: string; originalQuery: string; correctedQuery: string }>()
    const correctionTargets = new Map<string, number>()
    const addToCartByTerm = new Map<string, number>()
    let noResultSearches = 0
    let suggestionUsage = 0
    let correctedSearches = 0
    let sumResults = 0
    let searchesWithKnownResultCount = 0
    let searchAddToCart = 0

    for (const event of searchAddToCartEvents) {
      let meta: Record<string, unknown> = {}
      try {
        meta = event.metadata ? JSON.parse(event.metadata) : {}
      } catch {
        meta = {}
      }

      if (String(meta.source || '').toUpperCase() !== 'SEARCH') continue

      const query = String(meta.normalizedQuery || meta.query || '').trim().toLowerCase()
      if (!query) continue

      searchAddToCart += 1
      addToCartByTerm.set(query, (addToCartByTerm.get(query) || 0) + 1)
    }

    for (const event of events) {
      let meta: Record<string, unknown> = {}
      try {
        meta = event.metadata ? JSON.parse(event.metadata) : {}
      } catch {
        meta = {}
      }

      const originalQuery = String(meta.originalQuery || meta.query || '').trim().toLowerCase()
      const normalizedQuery = String(meta.normalizedQuery || meta.query || '').trim().toLowerCase()
      const query = normalizedQuery || originalQuery
      if (!query) continue

      const hasResultCount = Object.prototype.hasOwnProperty.call(meta, 'resultCount')
      const parsedResultCount = hasResultCount ? Number(meta.resultCount) : null
      const resultCount = Number.isFinite(parsedResultCount) ? Math.max(0, Number(parsedResultCount)) : null
      const usedSuggestion = Boolean(meta.usedSuggestion)
      const corrected = Boolean(meta.corrected) || (Boolean(originalQuery) && Boolean(normalizedQuery) && originalQuery !== normalizedQuery)
      const correctedFrom = String(meta.correctedFrom || originalQuery || '').trim().toLowerCase()
      const correctedTo = String(meta.correctedTo || normalizedQuery || '').trim().toLowerCase()

      if (usedSuggestion) suggestionUsage += 1
      if (resultCount !== null && resultCount === 0) noResultSearches += 1
      if (corrected) correctedSearches += 1
      if (resultCount !== null) {
        sumResults += resultCount
        searchesWithKnownResultCount += 1
      }

      if (corrected && correctedFrom && correctedTo && correctedFrom !== correctedTo) {
        const correctionKey = `${correctedFrom}=>${correctedTo}`
        const currentCorrection = corrections.get(correctionKey) || {
          count: 0,
          lastAt: event.createdAt.toISOString(),
          originalQuery: correctedFrom,
          correctedQuery: correctedTo,
        }
        currentCorrection.count += 1
        if (event.createdAt.toISOString() > currentCorrection.lastAt) {
          currentCorrection.lastAt = event.createdAt.toISOString()
        }
        corrections.set(correctionKey, currentCorrection)
        correctionTargets.set(correctedTo, (correctionTargets.get(correctedTo) || 0) + 1)
      }

      const current = terms.get(query) || {
        count: 0,
        noResults: 0,
        suggestionUsage: 0,
        correctedCount: 0,
        lastAt: event.createdAt.toISOString(),
      }
      current.count += 1
      if (resultCount !== null && resultCount === 0) current.noResults += 1
      if (usedSuggestion) current.suggestionUsage += 1
      if (corrected) current.correctedCount += 1
      if (event.createdAt.toISOString() > current.lastAt) {
        current.lastAt = event.createdAt.toISOString()
      }
      terms.set(query, current)
    }

    const rows = [...terms.entries()].map(([query, value]) => ({
      query,
      count: value.count,
      noResults: value.noResults,
      suggestionUsage: value.suggestionUsage,
      correctedCount: value.correctedCount,
      noResultRate: value.count > 0 ? Number((value.noResults / value.count).toFixed(3)) : 0,
      suggestionRate: value.count > 0 ? Number((value.suggestionUsage / value.count).toFixed(3)) : 0,
      correctedRate: value.count > 0 ? Number((value.correctedCount / value.count).toFixed(3)) : 0,
      addToCartCount: addToCartByTerm.get(query) || 0,
      conversionRate: value.count > 0 ? Number(((addToCartByTerm.get(query) || 0) / value.count).toFixed(3)) : 0,
      adDemandScore: Number((value.count * (1 + ((value.noResults / Math.max(value.count, 1)) * 1.5) + ((value.suggestionUsage / Math.max(value.count, 1)) * 0.7) + ((value.correctedCount / Math.max(value.count, 1)) * 0.5) + (((addToCartByTerm.get(query) || 0) / Math.max(value.count, 1)) * 0.8))).toFixed(2)),
      lastAt: value.lastAt,
    }))

    const toAdTier = (score: number) => {
      if (score >= 20) return 'ouro'
      if (score >= 10) return 'prata'
      return 'bronze'
    }

    const adOpportunities = rows
      .filter((row) => row.count >= 2)
      .sort((a, b) => b.adDemandScore - a.adDemandScore)
      .slice(0, safeLimit)
      .map((row) => ({
        query: row.query,
        searches: row.count,
        noResultRate: row.noResultRate,
        suggestionRate: row.suggestionRate,
        correctedRate: row.correctedRate,
        adDemandScore: row.adDemandScore,
        adTier: toAdTier(row.adDemandScore),
      }))

    return {
      totals: {
        searches: rows.reduce((acc, row) => acc + row.count, 0),
        uniqueTerms: rows.length,
        noResultSearches,
        noResultRate: rows.length > 0 ? Number((noResultSearches / Math.max(rows.reduce((acc, row) => acc + row.count, 0), 1)).toFixed(3)) : 0,
        suggestionUsage,
        correctedSearches,
        correctionRate: rows.length > 0 ? Number((correctedSearches / Math.max(rows.reduce((acc, row) => acc + row.count, 0), 1)).toFixed(3)) : 0,
        avgResults: searchesWithKnownResultCount > 0 ? Number((sumResults / searchesWithKnownResultCount).toFixed(2)) : 0,
        searchesWithKnownResultCount,
        searchAddToCart,
        searchConversionRate: rows.length > 0 ? Number((searchAddToCart / Math.max(rows.reduce((acc, row) => acc + row.count, 0), 1)).toFixed(3)) : 0,
      },
      topTerms: rows.sort((a, b) => b.count - a.count).slice(0, safeLimit),
      noResultTerms: rows
        .filter((row) => row.noResults > 0)
        .sort((a, b) => b.noResults - a.noResults)
        .slice(0, safeLimit),
      topConvertingTerms: rows
        .filter((row) => row.addToCartCount > 0)
        .sort((a, b) => b.addToCartCount - a.addToCartCount)
        .slice(0, safeLimit)
        .map((row) => ({
          query: row.query,
          searches: row.count,
          addToCartCount: row.addToCartCount,
          conversionRate: row.conversionRate,
        })),
      adOpportunities,
      topCorrections: [...corrections.values()]
        .sort((a, b) => b.count - a.count)
        .slice(0, safeLimit),
      topCorrectedIntentTargets: [...correctionTargets.entries()]
        .map(([query, count]) => ({ query, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, safeLimit),
    }
  }

  private calculateDeltaMetric(current: number, previous: number) {
    const delta = current - previous
    const deltaPercent = previous > 0 ? Number(((delta / previous) * 100).toFixed(2)) : 0
    return { current, previous, delta, deltaPercent }
  }

  private async calculateFunnelForDateRange(from: Date, to: Date) {
    const views = await this.prisma.analyticsEvent.count({
      where: { type: 'VIEW_PRODUCT', createdAt: { gte: from, lt: to } }
    })
    const addedToCart = await this.prisma.analyticsEvent.count({
      where: { type: 'ADD_TO_CART', createdAt: { gte: from, lt: to } }
    })
    const checkoutStarted = await this.prisma.analyticsEvent.count({
      where: { type: 'INITIATE_CHECKOUT', createdAt: { gte: from, lt: to } }
    })
    const purchased = await this.prisma.order.count({
      where: { status: 'COMPLETED', createdAt: { gte: from, lt: to } }
    })

    return { views, addedToCart, checkoutStarted, purchased }
  }

  private async calculateOrderMetrics(from: Date, to: Date) {
    const totalOrders = await this.prisma.order.count({
      where: { status: 'COMPLETED', createdAt: { gte: from, lt: to } }
    })

    const orders = await this.prisma.order.findMany({
      where: { status: 'COMPLETED', createdAt: { gte: from, lt: to } },
      select: { total: true }
    })

    const totalRevenue = orders.reduce((sum, order) => sum + Number(order.total || 0), 0)

    return { totalOrders, totalRevenue }
  }

  async getFunnelWithComparison(daysWindow = 7) {
    const safeDays = Math.max(1, Math.min(90, daysWindow))
    
    // Current period: last N days
    const currentEnd = new Date()
    const currentStart = new Date()
    currentStart.setDate(currentStart.getDate() - safeDays)

    // Previous period: N days before current
    const previousEnd = new Date(currentStart)
    const previousStart = new Date(previousEnd)
    previousStart.setDate(previousStart.getDate() - safeDays)

    const current = await this.calculateFunnelForDateRange(currentStart, currentEnd)
    const previous = await this.calculateFunnelForDateRange(previousStart, previousEnd)

    const currentConversionRate = current.views > 0 ? Number(((current.purchased / current.views) * 100).toFixed(2)) : 0
    const previousConversionRate = previous.views > 0 ? Number(((previous.purchased / previous.views) * 100).toFixed(2)) : 0
    const conversionRateDelta = Number((currentConversionRate - previousConversionRate).toFixed(2))
    const conversionRateDeltaPercent = previousConversionRate > 0
      ? Number(((conversionRateDelta / previousConversionRate) * 100).toFixed(2))
      : 0

    const currentAbandonRate = current.addedToCart > 0 ? Number(((1 - current.checkoutStarted / current.addedToCart) * 100).toFixed(2)) : 0
    const previousAbandonRate = previous.addedToCart > 0 ? Number(((1 - previous.checkoutStarted / previous.addedToCart) * 100).toFixed(2)) : 0
    const abandonRateDelta = Number((currentAbandonRate - previousAbandonRate).toFixed(2))
    const abandonRateDeltaPercent = previousAbandonRate > 0
      ? Number(((abandonRateDelta / previousAbandonRate) * 100).toFixed(2))
      : 0

    return {
      funnel: {
        current,
        previous,
      },
      metrics: {
        conversionRate: {
          current: currentConversionRate,
          previous: previousConversionRate,
          delta: conversionRateDelta,
          deltaPercent: conversionRateDeltaPercent,
        },
        cartAbandonRate: {
          current: currentAbandonRate,
          previous: previousAbandonRate,
          delta: abandonRateDelta,
          deltaPercent: abandonRateDeltaPercent,
        },
      },
      period: {
        current: `${safeDays}d`,
        previous: `${safeDays}d (anterior)`,
      }
    }
  }

  async getBiInsightsWithComparison(daysWindow = 7) {
    const safeDays = Math.max(1, Math.min(90, daysWindow))

    // Current period
    const currentEnd = new Date()
    const currentStart = new Date()
    currentStart.setDate(currentStart.getDate() - safeDays)

    // Previous period
    const previousEnd = new Date(currentStart)
    const previousStart = new Date(previousEnd)
    previousStart.setDate(previousStart.getDate() - safeDays)

    const currentMetrics = await this.calculateOrderMetrics(currentStart, currentEnd)
    const previousMetrics = await this.calculateOrderMetrics(previousStart, previousEnd)

    return {
      revenue: this.calculateDeltaMetric(currentMetrics.totalRevenue, previousMetrics.totalRevenue),
      orders: this.calculateDeltaMetric(currentMetrics.totalOrders, previousMetrics.totalOrders),
      period: {
        current: `Últimos ${safeDays}d`,
        previous: `${safeDays}d anterior`,
      }
    }
  }

  private normalizeAnalyticsWindow(days = 7, from?: string, to?: string) {
    const safeDays = Math.max(1, Math.min(365, Number(days) || 7))
    const periodEnd = to ? new Date(to) : new Date()
    const periodStart = from ? new Date(from) : new Date(periodEnd)
    if (!from) periodStart.setDate(periodStart.getDate() - safeDays)
    return { periodStart, periodEnd, safeDays }
  }

  private analyticsScope(tenantId = 'tenant_default', storeId?: string) {
    return storeId ? { tenantId, storeId } : { tenantId }
  }

  private parseAnalyticsMetadata(metadata?: string | null) {
    if (!metadata) return {}
    try {
      return JSON.parse(metadata)
    } catch {
      return {}
    }
  }

  private pushMetric(
    rows: Prisma.MetricSnapshotCreateManyInput[],
    base: {
      tenantId: string
      storeId?: string
      periodStart: Date
      periodEnd: Date
      period?: string
    },
    metric: {
      dashboard: string
      metric: string
      value: number
      unit?: string
      dimension?: string
      dimensionValue?: string
      channel?: string
      productId?: string
      category?: string
      metadata?: Prisma.InputJsonValue
    },
  ) {
    rows.push({
      tenantId: base.tenantId,
      storeId: base.storeId || 'ALL',
      period: base.period || 'DAY',
      periodStart: base.periodStart,
      periodEnd: base.periodEnd,
      dashboard: metric.dashboard,
      metric: metric.metric,
      dimension: metric.dimension || 'GLOBAL',
      dimensionValue: metric.dimensionValue || 'ALL',
      channel: metric.channel || 'ALL',
      productId: metric.productId || 'ALL',
      category: metric.category || 'ALL',
      value: Number(Number(metric.value || 0).toFixed(3)),
      unit: metric.unit || 'COUNT',
      metadata: metric.metadata || undefined,
    })
  }

  private aggregateBy<T>(rows: T[], keyGetter: (row: T) => string, valueGetter: (row: T) => number) {
    const result = new Map<string, number>()
    for (const row of rows) {
      const key = keyGetter(row) || 'UNKNOWN'
      result.set(key, (result.get(key) || 0) + valueGetter(row))
    }
    return result
  }

  private async buildMetricSnapshotRows(params: { tenantId?: string; storeId?: string; from?: string; to?: string; days?: number }) {
    const tenantId = params.tenantId || 'tenant_default'
    const { periodStart, periodEnd } = this.normalizeAnalyticsWindow(params.days || 7, params.from, params.to)
    const orderWhere = {
      ...this.analyticsScope(tenantId, params.storeId),
      status: { not: 'CANCELLED' },
      createdAt: { gte: periodStart, lt: periodEnd },
    }
    const scope = this.analyticsScope(tenantId, params.storeId)
    const rows: Prisma.MetricSnapshotCreateManyInput[] = []

    const [orders, events, orderItems, stockPositions, pickingTasks, integrationJobs, deadLetters, customerProfiles, paymentTransactions] = await Promise.all([
      this.prisma.order.findMany({
        where: orderWhere,
        select: {
          id: true,
          storeId: true,
          channel: true,
          total: true,
          status: true,
          createdAt: true,
          items: {
            select: {
              productId: true,
              quantity: true,
              subtotal: true,
              finalSubtotal: true,
              status: true,
              cutReason: true,
              product: { select: { id: true, name: true, category: true, classification01: true } },
            },
          },
        },
      }),
      this.prisma.analyticsEvent.findMany({
        where: { ...scope, createdAt: { gte: periodStart, lt: periodEnd } },
        select: { type: true, storeId: true, channel: true, entity: true, entityId: true, metadata: true, createdAt: true },
      }),
      this.prisma.orderItem.findMany({
        where: { ...scope, createdAt: { gte: periodStart, lt: periodEnd } },
        select: {
          productId: true,
          quantity: true,
          subtotal: true,
          finalSubtotal: true,
          status: true,
          cutReason: true,
          order: { select: { channel: true, status: true } },
          product: { select: { id: true, name: true, category: true, classification01: true } },
        },
      }),
      this.prisma.stockPosition.findMany({
        where: { ...scope, available: { lte: 0 } },
        select: { storeId: true, productId: true, available: true },
      }),
      this.prisma.pickingTask.findMany({
        where: { ...scope, createdAt: { gte: periodStart, lt: periodEnd } },
        select: { id: true, storeId: true, status: true, assignedToId: true, startedAt: true, completedAt: true, slaDueAt: true },
      }),
      this.prisma.integrationJob.findMany({
        where: { ...scope, createdAt: { gte: periodStart, lt: periodEnd } },
        select: { storeId: true, type: true, status: true, connectorId: true, error: true },
      }),
      this.prisma.integrationDeadLetter.findMany({
        where: { ...scope, createdAt: { gte: periodStart, lt: periodEnd }, resolvedAt: null },
        select: { storeId: true, connectorId: true, reason: true, lastError: true },
      }),
      this.prisma.customerProfile.findMany({
        where: { ...scope },
        select: { customerId: true, storeId: true, ltv: true, orderCount: true, lastOrderAt: true, churnRiskScore: true },
      }),
      this.prisma.paymentTransaction.findMany({
        where: { ...scope, createdAt: { gte: periodStart, lt: periodEnd } },
        select: { storeId: true, provider: true, method: true, status: true, amount: true },
      }),
    ])

    const base = { tenantId, storeId: params.storeId, periodStart, periodEnd, period: 'DAY' }
    const gmv = orders.reduce((sum, order) => sum + Number(order.total || 0), 0)
    const orderCount = orders.length
    const averageTicket = orderCount > 0 ? gmv / orderCount : 0
    this.pushMetric(rows, base, { dashboard: 'EXECUTIVE', metric: 'GMV', value: gmv, unit: 'BRL' })
    this.pushMetric(rows, base, { dashboard: 'EXECUTIVE', metric: 'ORDERS', value: orderCount })
    this.pushMetric(rows, base, { dashboard: 'EXECUTIVE', metric: 'AVERAGE_TICKET', value: averageTicket, unit: 'BRL' })
    this.pushMetric(rows, base, { dashboard: 'EXECUTIVE', metric: 'ESTIMATED_MARGIN', value: gmv * 0.1, unit: 'BRL', metadata: { rule: 'fallback_10_percent_until_cost_model' } })

    for (const [storeId, value] of this.aggregateBy(orders, (order) => order.storeId, (order) => Number(order.total || 0))) {
      this.pushMetric(rows, base, { dashboard: 'EXECUTIVE', metric: 'REVENUE_BY_STORE', value, unit: 'BRL', dimension: 'STORE', dimensionValue: storeId })
    }
    for (const [channel, value] of this.aggregateBy(orders, (order) => order.channel || 'STOREFRONT', (order) => Number(order.total || 0))) {
      this.pushMetric(rows, base, { dashboard: 'EXECUTIVE', metric: 'REVENUE_BY_CHANNEL', value, unit: 'BRL', dimension: 'CHANNEL', dimensionValue: channel, channel })
    }
    for (const [status, value] of this.aggregateBy(orders, (order) => order.status, () => 1)) {
      this.pushMetric(rows, base, { dashboard: 'OPERATIONAL', metric: 'ORDERS_BY_STATUS', value, dimension: 'STATUS', dimensionValue: status })
    }

    const revenueByCategory = this.aggregateBy(orderItems, (item) => item.product?.category || item.product?.classification01 || 'GERAL', (item) => Number(item.finalSubtotal || item.subtotal || 0))
    for (const [category, value] of revenueByCategory) {
      this.pushMetric(rows, base, { dashboard: 'CATALOG', metric: 'REVENUE_BY_CATEGORY', value, unit: 'BRL', dimension: 'CATEGORY', dimensionValue: category, category })
    }

    const eventCount = (types: string[]) => events.filter((event) => types.includes(event.type)).length
    const sessions = new Set(events.map((event) => {
      const meta = this.parseAnalyticsMetadata(event.metadata)
      return meta.sessionId || meta.deviceId || event.entityId || `${event.type}:${event.createdAt?.toISOString?.() || ''}`
    })).size
    const searches = eventCount(['SEARCH'])
    const pdpViews = eventCount(['VIEW_PRODUCT', 'PDP_VIEW'])
    const addToCart = eventCount(['ADD_TO_CART'])
    const checkoutStarted = eventCount(['INITIATE_CHECKOUT', 'CHECKOUT_STARTED'])
    const checkoutCompleted = eventCount(['CHECKOUT_COMPLETED', 'PURCHASE']) + orders.filter((order) => ['COMPLETED', 'DELIVERED'].includes(order.status)).length
    const noResultSearches = events.filter((event) => {
      if (event.type !== 'SEARCH') return false
      const meta = this.parseAnalyticsMetadata(event.metadata)
      return Number(meta.resultCount || 0) === 0 || meta.noResults === true
    }).length
    this.pushMetric(rows, base, { dashboard: 'EXECUTIVE', metric: 'SESSIONS', value: sessions })
    this.pushMetric(rows, base, { dashboard: 'FUNNEL', metric: 'SEARCHES', value: searches })
    this.pushMetric(rows, base, { dashboard: 'FUNNEL', metric: 'PDP_VIEWS', value: pdpViews })
    this.pushMetric(rows, base, { dashboard: 'FUNNEL', metric: 'ADD_TO_CART', value: addToCart })
    this.pushMetric(rows, base, { dashboard: 'FUNNEL', metric: 'CHECKOUT_STARTED', value: checkoutStarted })
    this.pushMetric(rows, base, { dashboard: 'FUNNEL', metric: 'CHECKOUT_COMPLETED', value: checkoutCompleted })
    this.pushMetric(rows, base, { dashboard: 'FUNNEL', metric: 'CART_ABANDONMENT_RATE', value: addToCart > 0 ? (1 - checkoutCompleted / addToCart) * 100 : 0, unit: 'PERCENT' })
    this.pushMetric(rows, base, { dashboard: 'FUNNEL', metric: 'NO_RESULT_SEARCHES', value: noResultSearches })

    const searchedProducts = this.aggregateBy(events.filter((event) => event.type === 'SEARCH'), (event) => {
      const meta = this.parseAnalyticsMetadata(event.metadata)
      return String(meta.query || meta.normalizedQuery || event.entityId || 'UNKNOWN')
    }, () => 1)
    for (const [query, value] of [...searchedProducts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20)) {
      this.pushMetric(rows, base, { dashboard: 'CATALOG', metric: 'TOP_SEARCHED_TERM', value, dimension: 'SEARCH_TERM', dimensionValue: query })
    }

    const cutItems = orderItems.filter((item) => ['CUT', 'REMOVED', 'UNAVAILABLE'].includes(String(item.status || '').toUpperCase()))
    const acceptedSubstitutions = orderItems.filter((item) => ['SUBSTITUTED', 'SUBSTITUTION_ACCEPTED'].includes(String(item.status || '').toUpperCase()))
    const rejectedSubstitutions = orderItems.filter((item) => ['SUBSTITUTION_REJECTED', 'REJECTED_SUBSTITUTION'].includes(String(item.status || '').toUpperCase()))
    this.pushMetric(rows, base, { dashboard: 'RUPTURE', metric: 'RUPTURE_PRODUCTS', value: stockPositions.length })
    this.pushMetric(rows, base, { dashboard: 'RUPTURE', metric: 'CUT_ITEMS', value: cutItems.length })
    this.pushMetric(rows, base, { dashboard: 'RUPTURE', metric: 'SUBSTITUTIONS_ACCEPTED', value: acceptedSubstitutions.length })
    this.pushMetric(rows, base, { dashboard: 'RUPTURE', metric: 'SUBSTITUTIONS_REJECTED', value: rejectedSubstitutions.length })

    for (const [productId, value] of this.aggregateBy(cutItems, (item) => item.productId, (item) => Number(item.subtotal || 0))) {
      this.pushMetric(rows, base, { dashboard: 'RUPTURE', metric: 'LOST_SALES_BY_PRODUCT', value, unit: 'BRL', dimension: 'PRODUCT', dimensionValue: productId, productId })
    }
    for (const [category, value] of this.aggregateBy(cutItems, (item) => item.product?.category || 'GERAL', (item) => Number(item.subtotal || 0))) {
      this.pushMetric(rows, base, { dashboard: 'RUPTURE', metric: 'LOST_SALES_BY_CATEGORY', value, unit: 'BRL', dimension: 'CATEGORY', dimensionValue: category, category })
    }

    const now = new Date()
    const delayedPicking = pickingTasks.filter((task) => task.slaDueAt && !['COMPLETED', 'CANCELLED'].includes(task.status) && task.slaDueAt < now)
    const completedPicking = pickingTasks.filter((task) => task.completedAt && task.startedAt)
    const pickingMinutes = completedPicking.map((task) => (new Date(task.completedAt!).getTime() - new Date(task.startedAt!).getTime()) / 60000)
    this.pushMetric(rows, base, { dashboard: 'PICKING', metric: 'DELAYED_PICKING_TASKS', value: delayedPicking.length })
    this.pushMetric(rows, base, { dashboard: 'PICKING', metric: 'PICKING_PRODUCTIVITY', value: completedPicking.length, unit: 'TASKS' })
    this.pushMetric(rows, base, { dashboard: 'PICKING', metric: 'AVG_PICKING_MINUTES', value: pickingMinutes.length > 0 ? pickingMinutes.reduce((sum, value) => sum + value, 0) / pickingMinutes.length : 0, unit: 'MINUTES' })

    const failedJobs = integrationJobs.filter((job) => ['FAILED', 'ERROR'].includes(String(job.status || '').toUpperCase()))
    this.pushMetric(rows, base, { dashboard: 'INTEGRATIONS', metric: 'INTEGRATION_FAILURES', value: failedJobs.length + deadLetters.length })
    this.pushMetric(rows, base, { dashboard: 'INTEGRATIONS', metric: 'DEAD_LETTERS_OPEN', value: deadLetters.length })

    const inactiveCutoff = new Date(periodEnd)
    inactiveCutoff.setDate(inactiveCutoff.getDate() - 30)
    const inactiveCustomers = customerProfiles.filter((profile) => !profile.lastOrderAt || profile.lastOrderAt < inactiveCutoff)
    const highRiskCustomers = customerProfiles.filter((profile) => Number(profile.churnRiskScore || 0) >= 70)
    this.pushMetric(rows, base, { dashboard: 'CRM', metric: 'INACTIVE_CUSTOMERS', value: inactiveCustomers.length })
    this.pushMetric(rows, base, { dashboard: 'CRM', metric: 'CHURN_RISK_CUSTOMERS', value: highRiskCustomers.length })
    this.pushMetric(rows, base, { dashboard: 'CRM', metric: 'LTV', value: customerProfiles.reduce((sum: number, profile) => sum + Number(profile.ltv || 0), 0), unit: 'BRL' })

    const failedPayments = paymentTransactions.filter((payment) => ['FAILED', 'DECLINED', 'CANCELLED'].includes(String(payment.status || '').toUpperCase()))
    this.pushMetric(rows, base, { dashboard: 'PAYMENTS', metric: 'PAYMENT_FAILURES', value: failedPayments.length })
    for (const [provider, value] of this.aggregateBy(paymentTransactions, (payment) => payment.provider, (payment) => Number(payment.amount || 0))) {
      this.pushMetric(rows, base, { dashboard: 'PAYMENTS', metric: 'PAYMENT_VOLUME_BY_PROVIDER', value, unit: 'BRL', dimension: 'PROVIDER', dimensionValue: provider })
    }

    return { rows, periodStart, periodEnd }
  }

  async generateMetricSnapshots(params: { tenantId?: string; storeId?: string; from?: string; to?: string; days?: number } = {}) {
    const { rows, periodStart, periodEnd } = await this.buildMetricSnapshotRows(params)
    await this.prisma.metricSnapshot.deleteMany({
      where: {
        tenantId: params.tenantId || 'tenant_default',
        storeId: params.storeId || 'ALL',
        period: 'DAY',
        periodStart,
        periodEnd,
      },
    })
    if (rows.length > 0) {
      await this.prisma.metricSnapshot.createMany({ data: rows })
    }
    return { created: rows.length, periodStart, periodEnd }
  }

  async getOperationalDashboard(params: { tenantId?: string; storeId?: string; dashboard?: string; days?: number } = {}) {
    const tenantId = params.tenantId || 'tenant_default'
    const { periodStart, periodEnd } = this.normalizeAnalyticsWindow(params.days || 7)
    const where: any = {
      tenantId,
      storeId: params.storeId || 'ALL',
      periodStart: { gte: periodStart, lt: periodEnd },
    }
    if (params.dashboard) where.dashboard = params.dashboard.toUpperCase()

    let snapshots = await this.prisma.metricSnapshot.findMany({
      where,
      orderBy: [{ dashboard: 'asc' }, { metric: 'asc' }, { value: 'desc' }],
      take: 500,
    })

    if (snapshots.length === 0) {
      await this.generateMetricSnapshots({ tenantId, storeId: params.storeId, days: params.days || 7 })
      snapshots = await this.prisma.metricSnapshot.findMany({
        where,
        orderBy: [{ dashboard: 'asc' }, { metric: 'asc' }, { value: 'desc' }],
        take: 500,
      })
    }

    const byDashboard = snapshots.reduce((acc: Record<string, any[]>, snapshot: any) => {
      acc[snapshot.dashboard] = acc[snapshot.dashboard] || []
      acc[snapshot.dashboard].push(snapshot)
      return acc
    }, {})

    return {
      period: { from: periodStart.toISOString(), to: periodEnd.toISOString() },
      dashboards: {
        executive: byDashboard.EXECUTIVE || [],
        operational: byDashboard.OPERATIONAL || [],
        catalog: byDashboard.CATALOG || [],
        rupture: byDashboard.RUPTURE || [],
        picking: byDashboard.PICKING || [],
        integrations: byDashboard.INTEGRATIONS || [],
        crm: byDashboard.CRM || [],
        payments: byDashboard.PAYMENTS || [],
        funnel: byDashboard.FUNNEL || [],
      },
      personas: {
        manager: (byDashboard.RUPTURE || []).filter((item: any) => String(item.metric).startsWith('LOST_SALES')),
        operator: (byDashboard.PICKING || []).filter((item: any) => item.metric === 'DELAYED_PICKING_TASKS'),
        tech: byDashboard.INTEGRATIONS || [],
        marketing: (byDashboard.CRM || []).filter((item: any) => ['INACTIVE_CUSTOMERS', 'CHURN_RISK_CUSTOMERS'].includes(item.metric)),
      },
    }
  }

  async drillDownMetric(params: { tenantId?: string; storeId?: string; metric?: string; dashboard?: string; dimension?: string; dimensionValue?: string; channel?: string; productId?: string; category?: string; days?: number }) {
    const tenantId = params.tenantId || 'tenant_default'
    const { periodStart, periodEnd } = this.normalizeAnalyticsWindow(params.days || 30)
    const where: any = {
      tenantId,
      storeId: params.storeId || 'ALL',
      periodStart: { gte: periodStart, lt: periodEnd },
    }
    if (params.metric) where.metric = params.metric.toUpperCase()
    if (params.dashboard) where.dashboard = params.dashboard.toUpperCase()
    if (params.dimension) where.dimension = params.dimension.toUpperCase()
    if (params.dimensionValue) where.dimensionValue = params.dimensionValue
    if (params.channel) where.channel = params.channel
    if (params.productId) where.productId = params.productId
    if (params.category) where.category = params.category

    const data = await this.prisma.metricSnapshot.findMany({
      where,
      orderBy: [{ periodStart: 'desc' }, { value: 'desc' }],
      take: 1000,
    })

    return { data, filters: where }
  }

  /**
   * M33.2: Calcula métricas de período e verifica se devem disparar alertas
   * Usa período atual vs. anterior para determinar se os alertas devem ser acionados
   */
  async checkAndTriggerAlerts(daysWindow = 7): Promise<{ triggered: Array<any>; skipped: Array<any> }> {
    const funnelComparison = await this.getFunnelWithComparison(daysWindow)
    const insightsComparison = await this.getBiInsightsWithComparison(daysWindow)

    const triggered: Array<any> = []
    const skipped: Array<any> = []

    // Para cada métrica, buscar as regras ativas e verificar se devem disparar
    const rules = await this.prisma.alertRule.findMany({
      where: { enabled: true },
    })

    for (const rule of rules) {
      let currentValue = 0
      let previousValue = 0
      let ruleTriggered = false

      switch (rule.metric) {
        case 'conversionRate':
          currentValue = funnelComparison.metrics.conversionRate.current
          previousValue = funnelComparison.metrics.conversionRate.previous
          break
        case 'cartAbandonRate':
          currentValue = funnelComparison.metrics.cartAbandonRate.current
          previousValue = funnelComparison.metrics.cartAbandonRate.previous
          break
        case 'revenue':
          currentValue = insightsComparison.revenue.current
          previousValue = insightsComparison.revenue.previous
          break
        case 'orders':
          currentValue = insightsComparison.orders.current
          previousValue = insightsComparison.orders.previous
          break
        default:
          skipped.push({ ruleId: rule.id, reason: 'metric_not_implemented' })
          continue
      }

      // Calcula o valor a verificar (absoluto ou % change)
      let valueToCheck = currentValue
      if (rule.comparisonType === 'percentChange' && previousValue !== 0) {
        valueToCheck = ((currentValue - previousValue) / previousValue) * 100
      }

      // Verifica condição do operador
      switch (rule.operator) {
        case 'below':
          ruleTriggered = valueToCheck < rule.threshold
          break
        case 'above':
          ruleTriggered = valueToCheck > rule.threshold
          break
        case 'equals':
          ruleTriggered = valueToCheck === rule.threshold
          break
      }

      if (ruleTriggered) {
        const severity = Math.abs(valueToCheck - rule.threshold) > 10 ? 'critical' : 'warning'
        const alertTriggered = await this.prisma.alertTriggered.create({
          data: {
            ruleId: rule.id,
            severity,
            value: valueToCheck,
            periodDays: daysWindow,
          },
        })
        triggered.push(alertTriggered)
      }
    }

    return { triggered, skipped }
  }
}
