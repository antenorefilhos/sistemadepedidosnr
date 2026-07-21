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

describe('Notificacoes - UI kit operacional', () => {
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

  function visitNotifications() {
    mockDashboardReads()

    cy.visit('/', {
      onBeforeLoad(win) {
        win.localStorage.setItem('adminToken', adminToken)
        win.localStorage.setItem('adminData', JSON.stringify(adminData))
      },
    })

    cy.contains('Notificacoes').click()
    cy.get('h1').should('contain', 'Notificações')
  }

  it('renderiza formulario de broadcast com controles do UI kit', () => {
    visitNotifications()

    cy.contains('Broadcast de campanha').should('be.visible')
    cy.get('#notification-type').should('have.value', 'PROMO')
    cy.get('#notification-title').should('have.attr', 'placeholder').and('include', 'Oferta')
    cy.get('#notification-body').should('have.attr', 'placeholder').and('include', '22h')
    cy.get('#notification-customer').should('have.attr', 'placeholder').and('include', 'todos')
    cy.contains('button', 'Enviar notificação').should('be.disabled')
  })

  it('envia campanha para um cliente especifico e limpa o formulario', () => {
    cy.intercept('POST', /\/(?:api\/)?notifications\/admin\/broadcast$/, { count: 1 }).as('broadcastNotifications')
    visitNotifications()

    cy.get('#notification-type').select('CAMPAIGN')
    cy.get('#notification-title').type('Semana premium')
    cy.get('#notification-body').type('Oferta exclusiva para clientes recorrentes.')
    cy.get('#notification-customer').type('customer-ui-123')
    cy.contains('button', 'Enviar notificação').click()

    cy.wait('@broadcastNotifications').its('request.body').should((body) => {
      expect(body.type).to.eq('CAMPAIGN')
      expect(body.title).to.eq('Semana premium')
      expect(body.body).to.eq('Oferta exclusiva para clientes recorrentes.')
      expect(body.customerId).to.eq('customer-ui-123')
    })
    cy.contains('Notificação enviada para 1 cliente(s).').should('be.visible')
    cy.get('#notification-title').should('have.value', '')
    cy.get('#notification-body').should('have.value', '')
    cy.get('#notification-customer').should('have.value', '')
  })

  it('envia promocao para todos quando customer id fica vazio', () => {
    cy.intercept('POST', /\/(?:api\/)?notifications\/admin\/broadcast$/, { count: 8 }).as('broadcastNotifications')
    visitNotifications()

    cy.get('#notification-title').type('Ofertas do dia')
    cy.get('#notification-body').type('Selecao de frescos com preco especial hoje.')
    cy.contains('button', 'Enviar notificação').click()

    cy.wait('@broadcastNotifications').its('request.body').should((body) => {
      expect(body.type).to.eq('PROMO')
      expect(body.title).to.eq('Ofertas do dia')
      expect(body.body).to.eq('Selecao de frescos com preco especial hoje.')
      expect(body).not.to.have.property('customerId')
    })
    cy.contains('Notificação enviada para 8 cliente(s).').should('be.visible')
  })

  it('exibe erro quando o broadcast falha', () => {
    cy.intercept('POST', /\/(?:api\/)?notifications\/admin\/broadcast$/, {
      statusCode: 500,
      body: { message: 'Erro simulado' },
    }).as('broadcastNotifications')
    visitNotifications()

    cy.get('#notification-title').type('Oferta indisponivel')
    cy.get('#notification-body').type('Mensagem com falha simulada.')
    cy.contains('button', 'Enviar notificação').click()

    cy.wait('@broadcastNotifications')
    cy.contains('Falha ao enviar notificação. Verifique os campos e tente novamente.').should('be.visible')
    cy.get('#notification-title').should('have.value', 'Oferta indisponivel')
    cy.get('#notification-body').should('have.value', 'Mensagem com falha simulada.')
  })
})
