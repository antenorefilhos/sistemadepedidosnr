const brandConfig = {
  storeName: 'Antenor UI Market',
  logoDesktopUrl: '/branding/antenor-admin-logo.svg',
  logoMobileUrl: '/branding/antenor-admin-logo.svg',
  primaryColor: '#5D082A',
  secondaryColor: '#D2BB8A',
}

function mockDashboardReads() {
  cy.intercept('GET', /\/(?:api\/)?brand$/, brandConfig).as('getBrandConfig')
  cy.intercept('PUT', /\/(?:api\/)?brand$/, {
    ...brandConfig,
    storeName: 'Antenor Premium UI',
    primaryColor: '#4A102A',
    secondaryColor: '#C9A86A',
    logoMobileUrl: null,
  }).as('updateBrandConfig')

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
}

describe('Identidade Visual - UI kit operacional', () => {
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

    cy.contains('Identidade Visual').click()
    cy.get('h1').should('contain', 'Identidade Visual')
    cy.wait('@getBrandConfig')
  })

  it('renderiza logos, cores e previsualizacao com componentes do UI kit', () => {
    cy.contains('Nome da loja').should('be.visible')
    cy.get('input[placeholder="Antenor & Filhos"]').should('have.value', brandConfig.storeName)
    cy.contains('Logo desktop / tablet').should('be.visible')
    cy.contains('Logo mobile').should('be.visible')
    cy.contains('Previsualização do header').should('be.visible')
    cy.get('input[placeholder="#5D082A"]').should('have.value', brandConfig.primaryColor)
    cy.get('input[placeholder="#D2BB8A"]').should('have.value', brandConfig.secondaryColor)
  })

  it('salva nome, cores e remocao de logo mobile', () => {
    cy.get('input[placeholder="Antenor & Filhos"]').clear().type('Antenor Premium UI')
    cy.get('input[placeholder="#5D082A"]').clear().type('#4A102A')
    cy.get('input[placeholder="#D2BB8A"]').clear().type('#C9A86A')
    cy.contains('Logo mobile').parent().contains('button', 'Remover logo').click()

    cy.contains('button', 'Salvar configurações').click()
    cy.wait('@updateBrandConfig').its('request.body').should((body) => {
      expect(body.storeName).to.eq('Antenor Premium UI')
      expect(body.logoMobileUrl).to.eq(null)
      expect(body.primaryColor).to.eq('#4A102A')
      expect(body.secondaryColor).to.eq('#C9A86A')
    })
    cy.contains('Configurações salvas com sucesso.').should('exist')
  })
})
