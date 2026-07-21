const emptyPage = { data: [], page: 1, total: 0, totalPages: 1 }

const healthOk = {
  status: 'ok',
  version: '1.24.73-alpha',
  services: {
    database: { status: 'ok', latencyMs: 10 },
    redis: { status: 'ok', latencyMs: 15 },
    meilisearch: { status: 'ok', latencyMs: 20 },
    solidcom: { status: 'ok', latencyMs: 30 },
  },
}

const emptySearchInsights = {
  totals: {
    searches: 0,
    uniqueTerms: 0,
    noResultSearches: 0,
    noResultRate: 0,
    suggestionUsage: 0,
    correctedSearches: 0,
    correctionRate: 0,
    avgResults: 0,
    searchesWithKnownResultCount: 0,
    searchAddToCart: 0,
    searchConversionRate: 0,
  },
  topTerms: [],
  noResultTerms: [],
  topConvertingTerms: [],
  adOpportunities: [],
  topCorrections: [],
  topCorrectedIntentTargets: [],
}

function fallbackFor(pathname: string) {
  if (pathname.includes('/health/detail')) return healthOk
  if (pathname.includes('/products/admin/availability-metrics')) {
    return { lowStockProducts: 0, alwaysEnabledWithZeroStock: 0, inactiveWithStock: 0 }
  }
  if (pathname.includes('/products/mercadological-tree')) return { data: [] }
  if (pathname.includes('/products/admin/mercadological-tree')) return { data: [] }
  if (pathname.includes('/products/admin')) return emptyPage
  if (pathname.includes('/products/analytics/top')) return []
  if (pathname.includes('/products')) return []
  if (pathname.includes('/customers/analytics/origin')) return []
  if (pathname.includes('/customers')) return []
  if (pathname.includes('/admin/orders')) return []
  if (pathname.includes('/orders/analytics/sales')) return { period: 'week', data: [] }
  if (pathname.includes('/orders/analytics/status')) return { total: 0, data: [] }
  if (pathname.includes('/orders/analytics/revenue')) {
    return {
      today: 0,
      week: 0,
      month: 0,
      delta: { todayVsYesterday: 0, weekVsPreviousWeek: 0, monthVsPreviousMonth: 0 },
    }
  }
  if (pathname.includes('/orders/analytics/category-revenue')) return []
  if (pathname.includes('/orders/analytics/heatmap')) return []
  if (pathname.includes('/admin/picking/performance')) return { totals: { tasks: 0, completed: 0, delayed: 0 }, pickers: [] }
  if (pathname.includes('/admin/picking')) return []
  if (pathname.includes('/analytics/admin/search-insights')) return emptySearchInsights
  if (pathname.includes('/analytics/admin/insights')) {
    return { overview: [], funnel: { views: 0, carts: 0, checkouts: 0, conversion: '0.0%' }, topWished: [] }
  }
  if (pathname.includes('/analytics/funnel')) {
    return { views: 0, addedToCart: 0, checkoutStarted: 0, purchased: 0 }
  }
  if (pathname.includes('/analytics/events')) return []
  if (pathname.includes('/integrations/operations/panel')) return { deadLetters: 0, outbox: {}, jobs: {} }
  if (pathname.includes('/integrations/solidcom/status')) return { enabled: false, productsCount: 0, lastSync: null, history: [] }
  if (pathname.includes('/brand')) return { freeShippingThreshold: 150 }
  if (pathname.includes('/delivery/zones')) return []
  if (pathname.includes('/admin/fulfillment/slots')) return []
  if (pathname.includes('/cms/store-banners/all')) return []
  return {}
}

beforeEach(() => {
  if (Cypress.spec.name === 'critical-flows.cy.ts') return

  cy.intercept('GET', 'http://localhost:3001/**', (req) => {
    req.reply(fallbackFor(new URL(req.url).pathname))
  })
})
