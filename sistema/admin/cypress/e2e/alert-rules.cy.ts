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

const initialRules = [
  {
    id: 'rule-delete',
    metric: 'conversionRate',
    comparisonType: 'absolute',
    threshold: 5,
    operator: 'below',
    description: 'Alerta quando conversao cair',
    enabled: true,
  },
  {
    id: 'rule-keep',
    metric: 'revenue',
    comparisonType: 'absolute',
    threshold: 1200,
    operator: 'above',
    description: 'Alerta de pico de receita',
    enabled: false,
  },
]

function mockDashboardReads() {
  let deleteRuleRemoved = false

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
  cy.intercept('GET', '**/analytics/alert-rules', (req) => {
    req.alias = 'getAlertRules'
    req.reply(deleteRuleRemoved ? [initialRules[1]] : initialRules)
  })
  cy.intercept('DELETE', '**/analytics/alert-rules/rule-delete', (req) => {
    deleteRuleRemoved = true
    req.alias = 'deleteAlertRule'
    req.reply({})
  })
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

describe('Regras de Alerta - confirmacao UI kit', () => {
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
    cy.wait('@getAlertRules')
    cy.contains('Regras de Alerta').scrollIntoView().should('be.visible')
  })

  it('cancela exclusao sem chamar DELETE', () => {
    cy.contains('tr', 'Alerta quando conversao cair').within(() => {
      cy.get('button[title="Deletar"]').click()
    })

    cy.contains('Excluir regra de alerta?').should('be.visible')
    cy.contains('"Alerta quando conversao cair"').should('be.visible')
    cy.contains('button', 'Cancelar').click()

    cy.contains('Excluir regra de alerta?').should('not.exist')
    cy.contains('Alerta quando conversao cair').should('be.visible')
  })

  it('exclui regra somente apos confirmacao controlada', () => {
    cy.contains('tr', 'Alerta quando conversao cair').within(() => {
      cy.get('button[title="Deletar"]').click()
    })

    cy.contains('button', 'Excluir regra').click()
    cy.wait('@deleteAlertRule').then(({ request }) => {
      expect(request.headers.authorization).to.contain('Bearer ')
    })
    cy.wait('@getAlertRules')

    cy.contains('Alerta quando conversao cair').should('not.exist')
    cy.contains('Alerta de pico de receita').should('be.visible')
  })
})
