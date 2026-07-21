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

const executiveReport = {
  period: {
    weekStart: '2026-06-01',
    weekEnd: '2026-06-07',
  },
  summary: {
    totalRevenue: 12450.75,
    totalOrders: 86,
    conversionRate: 7.25,
    cartAbandonRate: 18.5,
    averageOrderValue: 144.78,
  },
  topCategories: [
    { category: 'Carnes', revenue: 4200.5, orders: 28, percentage: 33.7 },
    { category: 'Hortifruti', revenue: 2100, orders: 19, percentage: 16.8 },
  ],
  topSearchTerms: [
    { term: 'picanha', count: 44, results: 12, noResultRate: 0 },
    { term: 'vinho premium', count: 18, results: 0, noResultRate: 100 },
  ],
  catalogGaps: [
    { term: 'vinho premium', searchCount: 18, noResultsCount: 18 },
  ],
  recommendations: [
    'Reforcar sortimento premium para termos sem resultado.',
  ],
}

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
  cy.intercept('GET', '**/orders/analytics/category-revenue*', [])
  cy.intercept('GET', '**/orders/analytics/heatmap*', [])
  cy.intercept('GET', '**/customers/analytics/origin*', [])
  cy.intercept('GET', '**/analytics/funnel*', {
    views: 10,
    addedToCart: 4,
    checkoutStarted: 2,
    purchased: 1,
  })
  cy.intercept('GET', '**/analytics/funnel-compare*', { statusCode: 404 })
  cy.intercept('GET', '**/analytics/admin/search-insights*', emptySearchInsights)
  cy.intercept('GET', '**/analytics/admin/insights*', {
    overview: [],
    funnel: { views: 10, carts: 4, checkouts: 2, conversion: '10.0%' },
    topWished: [],
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
  cy.intercept('GET', /\/(?:api\/)?analytics\/report-executive(?:\?.*)?$/, (req) => {
    if (req.query.format === 'csv') {
      req.alias = 'downloadExecutiveReportCsv'
      req.reply({
        headers: { 'content-type': 'text/csv;charset=utf-8' },
        body: 'categoria,receita\nCarnes,4200.50\n',
      })
      return
    }

    req.alias = 'getExecutiveReport'
    req.reply(executiveReport)
  })
}

describe('Relatorio Executivo - UI kit operacional', () => {
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
    cy.contains('Relatório Executivo Semanal').scrollIntoView().should('be.visible')
  })

  it('gera relatorio semanal e renderiza resumo, tabelas e recomendacoes', () => {
    cy.get('#executive-report-week').type('2026-06-01')
    cy.contains('button', 'Gerar Relatório').click()

    cy.wait('@getExecutiveReport').then(({ request }) => {
      expect(request.headers.authorization).to.contain('Bearer ')
      expect(request.query.week).to.eq('2026-06-01')
    })

    cy.contains('Período: 2026-06-01 a 2026-06-07').scrollIntoView().should('be.visible')
    cy.contains('Receita Total').should('be.visible')
    cy.contains('R$ 12.450,75').should('be.visible')
    cy.contains('Carnes').should('be.visible')
    cy.contains('picanha').should('be.visible')
    cy.contains('vinho premium').should('be.visible')
    cy.contains('Gaps de Catálogo').scrollIntoView().should('be.visible')
    cy.contains('Reforcar sortimento premium').scrollIntoView().should('be.visible')
  })

  it('habilita download CSV depois que o relatorio existe', () => {
    cy.get('#executive-report-week').type('2026-06-01')
    cy.contains('button', 'Gerar Relatório').click()
    cy.wait('@getExecutiveReport')

    cy.contains('button', 'CSV').should('not.be.disabled').click()
    cy.wait('@downloadExecutiveReportCsv').then(({ request, response }) => {
      expect(request.query.week).to.eq('2026-06-01')
      expect(request.query.format).to.eq('csv')
      expect(response?.body).to.contain('categoria,receita')
    })
  })
})
