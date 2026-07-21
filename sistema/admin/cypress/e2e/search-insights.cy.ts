const searchInsights = {
  totals: {
    searches: 128,
    uniqueTerms: 41,
    noResultSearches: 19,
    noResultRate: 0.15,
    suggestionUsage: 22,
    correctedSearches: 13,
    correctionRate: 0.1,
    avgResults: 7.4,
    searchesWithKnownResultCount: 120,
    searchAddToCart: 34,
    searchConversionRate: 0.27,
  },
  topTerms: [
    { query: 'picanha', count: 42, noResults: 0 },
    { query: 'cerveja artesanal', count: 21, noResults: 1 },
  ],
  noResultTerms: [
    { query: 'vinho premium', count: 10, noResults: 8 },
    { query: 'azeite trufado', count: 6, noResults: 6 },
  ],
  topConvertingTerms: [
    { query: 'arroz integral', searches: 20, addToCartCount: 7, conversionRate: 0.35 },
    { query: 'queijo coalho', searches: 16, addToCartCount: 5, conversionRate: 0.31 },
  ],
  adOpportunities: [
    {
      query: 'picanha',
      searches: 42,
      noResultRate: 0.02,
      suggestionRate: 0.08,
      correctedRate: 0.03,
      adDemandScore: 92.5,
      adTier: 'ouro',
    },
    {
      query: 'vinho premium',
      searches: 10,
      noResultRate: 0.8,
      suggestionRate: 0.12,
      correctedRate: 0.2,
      adDemandScore: 71.2,
      adTier: 'prata',
    },
  ],
  topCorrections: [
    {
      originalQuery: 'picana',
      correctedQuery: 'picanha',
      count: 6,
      lastAt: '2026-06-02T11:00:00.000Z',
    },
  ],
  topCorrectedIntentTargets: [
    { query: 'picanha', count: 9 },
  ],
}

const autoInsights = {
  overview: [],
  funnel: { views: 80, carts: 10, checkouts: 6, conversion: '7.5%' },
  topWished: [],
}

const getSearchPanel = () => cy.contains('h3', 'Saude da Busca').closest('div.bg-white')

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
  ])
  cy.intercept('GET', '**/orders/analytics/heatmap*', [])
  cy.intercept('GET', '**/customers/analytics/origin*', [
    { origin: 'WhatsApp', count: 18 },
  ])
  cy.intercept('GET', '**/analytics/funnel*', {
    views: 100,
    addedToCart: 8,
    checkoutStarted: 5,
    purchased: 2,
  })
  cy.intercept('GET', '**/analytics/funnel-compare*', { statusCode: 404 })
  cy.intercept('GET', '**/analytics/admin/search-insights*', (req) => {
    const days = String(req.query.days || '')
    const limit = String(req.query.limit || '')
    if (days === '30' && limit === '12') {
      req.alias = 'getSearchInsights30Top12'
    } else if (days === '30') {
      req.alias = 'getSearchInsights30'
    } else {
      req.alias = 'getSearchInsights'
    }
    req.reply(searchInsights)
  })
  cy.intercept('GET', '**/analytics/admin/insights*', autoInsights)
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

describe('Saude da Busca - UI kit operacional', () => {
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
    cy.wait('@getSearchInsights')
    cy.contains('Saude da Busca').should('exist').scrollIntoView()
    cy.wait(300)
  })

  it('renderiza metricas, gaps, correcoes, ads e conversoes', () => {
    getSearchPanel().within(() => {
      cy.contains('Buscas').should('exist')
      cy.contains('128').should('exist')
      cy.contains('Sem Resultado').should('exist')
      cy.contains('15%').should('exist')
      cy.contains('picanha').should('exist')
      cy.contains('42x').should('exist')
      cy.contains('vinho premium').should('exist')
      cy.contains('8 falhas').should('exist')
      cy.contains('picana').should('exist')
      cy.contains('ouro').should('exist')
      cy.contains('score:').should('exist')
      cy.contains('arroz integral').should('exist')
      cy.contains('35%').should('exist')
    })
  })

  it('aplica presets e usa toggles de secao com Button do UI kit', () => {
    getSearchPanel().within(() => {
      cy.contains('button', 'Preset comercial').click()
      cy.contains('Foco comercial').should('exist')
      cy.contains('2/7 recolhidas').should('exist')
      cy.contains('8 falhas').should('not.exist')

      cy.contains('p', 'Termos sem resultado')
        .parent()
        .contains('button', 'Expandir')
        .should('have.attr', 'aria-pressed', 'true')
        .click()

      cy.contains('8 falhas').should('exist')
      cy.contains('3/7 recolhidas').should('not.exist')
      cy.contains('1/7 recolhidas').should('exist')
    })
  })

  it('recolhe, expande e restaura a visao global', () => {
    getSearchPanel().within(() => {
      cy.contains('button', 'Recolher tudo').click()
      cy.contains('7/7 recolhidas').should('exist')
      cy.contains('42x').should('not.exist')

      cy.contains('button', 'Expandir tudo').click()
      cy.contains('0/7 recolhidas').should('exist')
      cy.contains('42x').should('exist')

      cy.contains('button', 'Preset operacional').click()
      cy.contains('4/7 recolhidas').should('exist')
      cy.contains('button', 'Restaurar padrao').click()
      cy.contains('0/7 recolhidas').should('exist')
    })
  })

  it('altera periodo, limite e atualiza pelo cabecalho com Select e Button do UI kit', () => {
    cy.get('#search-window-days').select('30')
    cy.wait('@getSearchInsights30').then(({ request }) => {
      expect(request.query.days).to.eq('30')
      expect(request.query.limit).to.eq('8')
    })

    cy.get('#search-top-limit').select('12')
    cy.wait('@getSearchInsights30Top12').then(({ request }) => {
      expect(request.query.days).to.eq('30')
      expect(request.query.limit).to.eq('12')
    })

    cy.contains('button', 'Atualizar agora').click()
    cy.wait('@getSearchInsights30Top12').then(({ request }) => {
      expect(request.query.days).to.eq('30')
      expect(request.query.limit).to.eq('12')
    })
  })
})
