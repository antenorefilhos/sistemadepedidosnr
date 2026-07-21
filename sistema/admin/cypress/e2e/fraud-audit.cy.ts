const fraudLogs = [
  {
    id: 'fraud-ui-1',
    vector: 'WHATSAPP',
    value: '+5524999990001',
    customerId: 'customer-whatsapp-001',
    createdAt: '2026-06-01T10:00:00.000Z',
  },
  {
    id: 'fraud-ui-2',
    vector: 'WHATSAPP',
    value: '+5524999990001',
    customerId: 'customer-whatsapp-002',
    createdAt: '2026-06-01T10:05:00.000Z',
  },
  {
    id: 'fraud-ui-3',
    vector: 'DEVICE',
    value: 'device-fingerprint-ui',
    customerId: null,
    createdAt: '2026-06-01T11:15:00.000Z',
  },
]

function mockDashboardReads() {
  cy.intercept('GET', /\/(?:api\/)?orders\/admin\/fraud-logs(?:\?.*)?$/, (req) => {
    const vector = req.query.vector
    const vectorValue = Array.isArray(vector) ? vector[0] : vector
    req.reply(vectorValue ? fraudLogs.filter((log) => log.vector === vectorValue) : fraudLogs)
  }).as('getFraudLogs')

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

describe('Anti-fraude - UI kit operacional', () => {
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

    cy.contains('Anti-fraude').click()
    cy.get('h1').should('contain', 'Auditoria de Anti-fraude')
    cy.wait('@getFraudLogs')
  })

  it('renderiza registros, badges de vetor e reincidencia', () => {
    cy.contains('3 registros').should('be.visible')
    cy.contains('WhatsApp').should('be.visible')
    cy.contains('Dispositivo').should('be.visible')
    cy.contains('+5524999990001').should('be.visible')
    cy.contains('2× bloqueado').should('be.visible')
    cy.contains('1ª ocorrência').should('be.visible')
  })

  it('filtra logs por dispositivo', () => {
    cy.contains('button', 'Dispositivo').click()

    cy.wait('@getFraudLogs').its('request.query').should((query) => {
      expect(query.vector).to.eq('DEVICE')
    })
    cy.contains('1 registros').should('be.visible')
    cy.contains('device-fingerprint-ui').should('be.visible')
    cy.contains('+5524999990001').should('not.exist')
  })

  it('exibe empty state quando nao ha registros para o vetor', () => {
    cy.contains('button', 'IP').click()

    cy.wait('@getFraudLogs').its('request.query').should((query) => {
      expect(query.vector).to.eq('IP')
    })
    cy.contains('0 registros').should('be.visible')
    cy.contains('Nenhuma ocorrência registrada.').should('be.visible')
  })
})
