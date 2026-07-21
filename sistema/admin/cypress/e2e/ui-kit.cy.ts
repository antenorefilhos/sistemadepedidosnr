const apiPattern = (path: string) => `**${path}`

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

describe('Admin UI Kit - shadcn/ui', () => {
  beforeEach(() => {
    cy.intercept('GET', '**/api/**', {})
    cy.intercept('GET', apiPattern('/admin/orders*'), [])
    cy.intercept('GET', apiPattern('/customers*'), [])
    cy.intercept('GET', apiPattern('/products/analytics/top*'), [])
    cy.intercept('GET', apiPattern('/products*'), [])
    cy.intercept('GET', apiPattern('/orders/analytics/sales*'), { period: 'week', data: [] })
    cy.intercept('GET', apiPattern('/orders/analytics/status*'), { total: 0, data: [] })
    cy.intercept('GET', apiPattern('/orders/analytics/revenue*'), {
      today: 0,
      week: 0,
      month: 0,
      delta: {
        todayVsYesterday: 0,
        weekVsPreviousWeek: 0,
        monthVsPreviousMonth: 0,
      },
    })
    cy.intercept('GET', apiPattern('/orders/analytics/category-revenue*'), [])
    cy.intercept('GET', apiPattern('/orders/analytics/heatmap*'), [])
    cy.intercept('GET', apiPattern('/customers/analytics/origin*'), [])
    cy.intercept('GET', apiPattern('/analytics/funnel*'), {
      views: 10,
      addedToCart: 4,
      checkoutStarted: 2,
      purchased: 1,
    })
    cy.intercept('GET', apiPattern('/analytics/funnel-compare*'), { statusCode: 404 })
    cy.intercept('GET', apiPattern('/analytics/events*'), [])
    cy.intercept('GET', apiPattern('/analytics/report-executive*'), {
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
    cy.intercept('GET', apiPattern('/analytics/admin/search-insights*'), emptySearchInsights)
    cy.intercept('GET', apiPattern('/analytics/admin/insights*'), {
      overview: [],
      funnel: { views: 10, carts: 4, checkouts: 2, conversion: '10.0%' },
      topWished: [],
    })
    cy.intercept('GET', apiPattern('/analytics/alert-rules'), (req) => {
      expect(req.headers.authorization).to.eq('Bearer test-admin-token')
      req.reply([
        {
          id: 'rule-1',
          metric: 'conversionRate',
          comparisonType: 'absolute',
          threshold: 5,
          operator: 'below',
          description: 'Alerta quando conversao cair',
          enabled: true,
        },
      ])
    }).as('alertRules')

    cy.visit('/', {
      onBeforeLoad(win) {
        win.localStorage.clear()
        win.sessionStorage.clear()
        win.localStorage.setItem('adminToken', 'test-admin-token')
        win.localStorage.setItem(
          'adminData',
          JSON.stringify({
            id: 'admin-1',
            email: 'admin@antenor.com.br',
            name: 'Admin Antenor',
            role: 'admin',
          }),
        )
      },
    })
  })

  it('abre Inteligencia e renderiza a superficie migrada para shadcn/ui', () => {
    cy.get('button[aria-label="Inteligencia IA"]').click()
    cy.get('h2').should('contain', 'Inteligencia (IA)')

    cy.contains('Regras de Alerta').scrollIntoView().should('be.visible')
    cy.contains('Nova Regra').should('be.visible')
    cy.contains('Taxa de Conversão (%)').should('be.visible')
    cy.contains('Alerta quando conversao cair').should('be.visible')
    cy.contains('Ativo').should('be.visible')

    cy.contains('Nova Regra').click()
    cy.contains('Métrica').should('be.visible')
    cy.contains('Tipo Comparação').should('be.visible')
    cy.contains('Valor Limite').should('be.visible')
    cy.get('input[placeholder="Ex: Alerta quando conversão cai abaixo de 5%"]').should('be.visible')
  })
})
