const weeklyHours = {
  0: { enabled: false, windows: [] },
  1: { enabled: true, windows: [{ start: '08:00', end: '12:00' }, { start: '14:00', end: '20:00' }] },
  2: { enabled: true, windows: [{ start: '08:00', end: '12:00' }, { start: '14:00', end: '20:00' }] },
  3: { enabled: true, windows: [{ start: '08:00', end: '12:00' }, { start: '14:00', end: '20:00' }] },
  4: { enabled: true, windows: [{ start: '08:00', end: '12:00' }, { start: '14:00', end: '20:00' }] },
  5: { enabled: true, windows: [{ start: '08:00', end: '12:00' }, { start: '14:00', end: '21:00' }] },
  6: { enabled: true, windows: [{ start: '08:00', end: '12:00' }, { start: '14:00', end: '18:00' }] },
}

const brandConfig = {
  storeName: 'Antenor UI Market',
  businessHours: JSON.stringify(weeklyHours),
  openMessage: 'Aberto para entregas UI',
  closedMessage: 'Fechado agora UI',
  countdownLabel: 'Voltamos em',
}

function mockDashboardReads() {
  cy.intercept('GET', /\/(?:api\/)?brand$/, brandConfig).as('getBrandConfig')
  cy.intercept('PUT', /\/(?:api\/)?brand$/, {
    ...brandConfig,
    openMessage: 'Entregas abertas no UI kit',
    closedMessage: 'Pausa operacional no UI kit',
    countdownLabel: 'Reabrimos em',
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

describe('Horarios de Funcionamento - UI kit operacional', () => {
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

    cy.contains('Horarios').click()
    cy.get('h1').should('contain', 'Horários de Funcionamento')
    cy.wait('@getBrandConfig')
  })

  it('renderiza dias, janelas e mensagens com componentes do UI kit', () => {
    cy.contains('Segunda-feira').should('be.visible')
    cy.contains('Domingo').scrollIntoView().should('be.visible')
    cy.contains('Mensagens personalizadas').should('be.visible')
    cy.contains('label', 'Mensagem quando aberto').parent().find('input').should('have.value', brandConfig.openMessage)
    cy.contains('label', 'Mensagem quando fechado').parent().find('input').should('have.value', brandConfig.closedMessage)
    cy.contains('label', 'Rótulo do countdown').parent().find('input').should('have.value', brandConfig.countdownLabel)

    cy.contains('Segunda-feira').scrollIntoView().parents('.bg-white.border').within(() => {
      cy.get('input[type="time"]').eq(0).should('have.value', '08:00')
      cy.get('input[type="time"]').eq(1).should('have.value', '12:00')
      cy.contains('button', '+ janela').should('be.visible')
    })
  })

  it('altera janela, mensagens e salva o payload da marca', () => {
    cy.contains('Segunda-feira').parents('.bg-white.border').within(() => {
      cy.contains('button', '+ janela').click()
      cy.get('input[type="time"]').eq(4).clear().type('21:00')
      cy.get('input[type="time"]').eq(5).clear().type('22:00')
    })

    cy.contains('label', 'Mensagem quando aberto').parent().find('input').clear().type('Entregas abertas no UI kit')
    cy.contains('label', 'Mensagem quando fechado').parent().find('input').clear().type('Pausa operacional no UI kit')
    cy.contains('label', 'Rótulo do countdown').parent().find('input').clear().type('Reabrimos em')

    cy.contains('button', 'Salvar').click()
    cy.wait('@updateBrandConfig').its('request.body').should((body) => {
      const savedHours = JSON.parse(body.businessHours)
      expect(savedHours[1].windows).to.have.length(3)
      expect(savedHours[1].windows[2]).to.deep.eq({ start: '21:00', end: '22:00' })
      expect(body.openMessage).to.eq('Entregas abertas no UI kit')
      expect(body.closedMessage).to.eq('Pausa operacional no UI kit')
      expect(body.countdownLabel).to.eq('Reabrimos em')
    })
  })
})
