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

const autoInsights = {
  overview: [
    { type: 'ADD_TO_CART', _count: { _all: 44 } },
  ],
  funnel: {
    views: 120,
    carts: 18,
    checkouts: 8,
    conversion: '12.5%',
  },
  topWished: [
    { name: 'Picanha Premium', count: 32 },
    { name: 'Queijo Coalho', count: 18 },
    { name: 'Carvao Vegetal', count: 11 },
    { name: 'Linguica Artesanal', count: 7 },
  ],
}

const getAutoInsightsPanel = () => cy.contains('h3', 'Insights Automaticos').parents('div.bg-gray-900')

function mockDashboardReads() {
  cy.intercept('GET', '**/customers*', [])
  cy.intercept('GET', '**/admin/orders*', [])
  cy.intercept('GET', '**/products/admin/availability-metrics*', {
    lowStockProducts: 0,
    alwaysEnabledWithZeroStock: 0,
    inactiveWithStock: 0,
  })
  cy.intercept('GET', '**/products/admin*', { data: [], page: 1, totalPages: 1 })
  cy.intercept('GET', '**/products/mercadological-tree*', { data: [] })
  cy.intercept('GET', '**/products/analytics/top*', [])
  cy.intercept('GET', '**/products*', [])
  cy.intercept('GET', '**/orders/analytics/sales*', { period: 'week', data: [] })
  cy.intercept('GET', '**/orders/analytics/status*', { total: 0, data: [] })
  cy.intercept('GET', '**/orders/analytics/revenue*', {
    today: 0,
    week: 0,
    month: 0,
    delta: {
      todayVsYesterday: 0,
      weekVsPreviousWeek: 0,
      monthVsPreviousMonth: 0,
    },
  })
  cy.intercept('GET', '**/orders/analytics/category-revenue*', [
    { category: 'Carnes', revenue: 6000, orders: 24 },
    { category: 'Hortifruti', revenue: 4000, orders: 18 },
  ])
  cy.intercept('GET', '**/orders/analytics/heatmap*', [])
  cy.intercept('GET', '**/customers/analytics/origin*', [
    { origin: 'WhatsApp', count: 18 },
    { origin: 'Instagram', count: 9 },
  ])
  cy.intercept('GET', '**/analytics/funnel*', {
    views: 100,
    addedToCart: 8,
    checkoutStarted: 5,
    purchased: 2,
  })
  cy.intercept('GET', '**/analytics/funnel-compare*', { statusCode: 404 })
  cy.intercept('GET', '**/analytics/admin/search-insights*', emptySearchInsights)
  cy.intercept('GET', '**/analytics/admin/insights*', (req) => {
    req.alias = 'getAutoInsights'
    req.reply(autoInsights)
  })
  cy.intercept('GET', '**/analytics/alert-rules', [])
  cy.intercept('GET', '**/admin/picking/tasks*', [])
  cy.intercept('GET', '**/admin/picking/eligible-orders*', [])
  cy.intercept('GET', '**/admin/picking/performance*', {
    totals: { tasks: 0, completed: 0, delayed: 0 },
    pickers: [],
  })
  cy.intercept('GET', '**/integrations/operations/panel*', {})
  cy.intercept('GET', '**/integrations/solidcom/status*', {
    provider: 'solidcom',
    connected: true,
    lastSyncAt: '2026-06-01T09:00:00.000Z',
  })
  cy.intercept('GET', /\/(?:api\/)?analytics\/report-executive(?:\?.*)?$/, {
    period: { weekStart: '2026-06-01', weekEnd: '2026-06-07' },
    summary: {
      totalRevenue: 0,
      totalOrders: 0,
      conversionRate: 0,
      cartAbandonRate: 0,
      averageOrderValue: 0,
    },
    topCategories: [],
    topSearchTerms: [],
    catalogGaps: [],
    recommendations: [],
  })
}

describe('Insights Automaticos - UI kit operacional', () => {
  let adminToken = ''
  let adminData = {
    id: 'admin',
    email: 'admin@antenor.com.br',
    name: 'Admin Antenor',
    role: 'admin',
  }

  before(() => {
    cy.task<{ access_token: string; admin?: typeof adminData }>('adminAuth').then((auth) => {
      adminToken = auth.access_token
      adminData = auth.admin || adminData
    })
  })

  beforeEach(() => {
    mockDashboardReads()

    cy.visit('/', {
      onBeforeLoad(win) {
        win.localStorage.setItem('adminToken', adminToken)
        win.localStorage.setItem('adminData', JSON.stringify(adminData))
      },
    })

    cy.get('button[aria-label="Inteligencia IA"]').click()
    cy.get('h2').should('contain', 'Inteligencia (IA)')
    cy.wait('@getAutoInsights')
    cy.contains('Insights Automaticos').scrollIntoView().should('be.visible')
  })

  it('renderiza insights detalhados e ranking de produtos desejados', () => {
    getAutoInsightsPanel().within(() => {
      cy.contains('Foco de Receita').should('be.visible')
      cy.contains('strong', 'Carnes').should('be.visible')
      cy.contains('60% do faturamento').should('be.visible')
      cy.contains('Carrinho Abandonado').should('be.visible')
      cy.contains('75% dos clientes').should('be.visible')
      cy.contains('Melhor Canal').should('be.visible')
      cy.contains('strong', 'WhatsApp').should('be.visible')
      cy.contains('Picanha Premium').should('be.visible')
      cy.contains('32 add(s)').should('be.visible')
    })
  })

  it('alterna modo compacto e detalhado usando Button do UI kit', () => {
    getAutoInsightsPanel().within(() => {
      cy.contains('button', 'Compacto').click()
      cy.contains('button', 'Compacto').should('have.attr', 'aria-pressed', 'true')
      cy.contains('Top categoria').should('be.visible')
      cy.contains('Abandono').should('be.visible')
      cy.contains('Melhor canal').should('be.visible')
      cy.contains('Foco de Receita').should('not.exist')

      cy.contains('button', 'Detalhado').click()
      cy.contains('button', 'Detalhado').should('have.attr', 'aria-pressed', 'true')
      cy.contains('Foco de Receita').should('be.visible')
    })
  })

  it('forca refresh dos insights automaticos', () => {
    getAutoInsightsPanel().find('button[aria-label="Atualizar insights automaticos"]').click()
    cy.wait('@getAutoInsights').then(({ request }) => {
      expect(request.headers.authorization).to.contain('Bearer ')
    })
  })
})
